import React, { useCallback } from 'react';
import {
  AuthPlugin,
  AuthPluginBase,
  AuthPluginProps,
} from '@deephaven/auth-plugins';
import { useClient } from '@deephaven/jsapi-bootstrap';
import { useBroadcastLoginListener } from '@deephaven/jsapi-components';
import Log from '@deephaven/log';
import Keycloak from 'keycloak-js';
import { LoginOptions } from '@deephaven/jsapi-types';

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
  authConfigValues,
  children,
}: AuthPluginProps): JSX.Element {
  const client = useClient();

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

  const getKeycloak = useCallback(() => {
    const url = getConfig(BASE_URL_PROPERTY);
    const realm = getConfig(REALM_PROPERTY);
    const clientId = getConfig(CLIENT_ID_PROPERTY);
    return new Keycloak({ realm, url, clientId });
  }, [getConfig]);

  const getLoginOptions = useCallback(async () => {
    const keycloak = getKeycloak();
    const authenticated = await keycloak.init({
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });
    if (!authenticated) {
      log.info(
        'User isn\'t logged in, redirecting to IDP (this may auto-redirect back here again)... Click "Go" again when you return.'
      );
      keycloak.login({});

      return new Promise<LoginOptions>(() => {
        // We just want to wait for keycloak to load, so return a promise that never resolves
      });
    }

    log.info('Keycloak api authenticated');
    const newProfile = await keycloak.loadUserProfile();
    const userInfo = await keycloak.loadUserInfo();
    log.info('Keycloak profile:', newProfile, 'userInfo:', userInfo);
    return { type: OIDC_AUTH_TYPE, token: keycloak.token };
  }, [getKeycloak]);

  const onLogin = useCallback(() => {
    log.debug('Received login event');
  }, []);
  const onLogout = useCallback(() => {
    try {
      const keycloak = getKeycloak();
      keycloak.clearToken();
    } catch (e) {
      log.error('Unable to clear token from keycloak:', e);
    }
  }, [getKeycloak]);
  useBroadcastLoginListener(onLogin, onLogout);

  return (
    <AuthPluginBase getLoginOptions={getLoginOptions}>
      {children}
    </AuthPluginBase>
  );
}

const AuthPluginKeycloak: AuthPlugin = {
  Component,
  isAvailable: authHandlers => authHandlers.includes(OIDC_AUTH_TYPE),
};

export default AuthPluginKeycloak;
