import React, { useCallback, useEffect, useState } from 'react';
import { AuthPlugin, AuthPluginProps } from '@deephaven/auth-plugins';
import { LoadingOverlay } from '@deephaven/components';
import Log from '@deephaven/log';
import Keycloak from 'keycloak-js';

const log = Log.module('@deephaven/js-plugin-auth-keycloak.AuthPluginKeycloak');

const OIDC_AUTH_TYPE =
  'io.deephaven.authentication.oidc.OidcAuthenticationHandler';

const BASE_URL_PROPERTY = 'authentication.oidc.keycloak.url';
const REALM_PROPERTY = 'authentication.oidc.keycloak.realm';
const CLIENT_ID_PROPERTY = 'authentication.oidc.keycloak.clientId';

/**
 * AuthPlugin that redirects the user to the configured keycloak instance.
 */
function Component({
  client,
  authConfigValues,
  onSuccess,
  onFailure,
}: AuthPluginProps): JSX.Element {
  const [error, setError] = useState<unknown>();

  const getConfig = useCallback(
    (key: string) => {
      const value = authConfigValues.get(key);
      if (value == null) {
        throw new Error(
          `Keycloak config value ${key} not specified by the server`
        );
      }
      return value;
    },
    [authConfigValues]
  );

  useEffect(() => {
    let isCanceled = false;
    async function login() {
      try {
        const url = getConfig(BASE_URL_PROPERTY);
        const realm = getConfig(REALM_PROPERTY);
        const clientId = getConfig(CLIENT_ID_PROPERTY);
        const keycloak = new Keycloak({ realm, url, clientId });
        const authenticated = await keycloak.init({
          pkceMethod: 'S256',
          checkLoginIframe: false,
        });
        if (isCanceled) {
          log.info('Previous login failure canceled');
          return;
        }
        if (!authenticated) {
          log.info(
            'User isn\'t logged in, redirecting to IDP (this may auto-redirect back here again)... Click "Go" again when you return.'
          );
          keycloak.login({});
          return;
        }

        log.info('Keycloak api authenticated');
        await client.login({ type: OIDC_AUTH_TYPE, token: keycloak.token });
        onSuccess();
      } catch (e) {
        if (isCanceled) {
          log.info('Previous login failure canceled');
          return;
        }
        log.error('Unable to login:', e);
        setError(e);
        onFailure(e);
      }
    }
    login();
    return () => {
      isCanceled = true;
    };
  }, [client, getConfig, onFailure, onSuccess]);
  return (
    <LoadingOverlay
      data-testid="auth-keycloak-loading"
      isLoading
      isLoaded={false}
      errorMessage={error != null ? `${error}` : null}
    />
  );
}

const AuthPluginKeycloak: AuthPlugin = {
  Component,
  isAvailable: authHandlers => authHandlers.includes(OIDC_AUTH_TYPE),
};

export default AuthPluginKeycloak;
