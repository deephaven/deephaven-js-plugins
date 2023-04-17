import React, { useEffect, useState } from 'react';

import { AuthPlugin, AuthPluginProps } from '@deephaven/auth-plugin';
import Log from '@deephaven/log';
import { LoadingOverlay } from '@deephaven/components';
import Keycloak from 'keycloak-js';

const log = Log.module('AuthPluginKeyCloak');

const OIDC_AUTH_TYPE = 'io.deephaven.authentication.oidc.OidcAuthenticationHandler';

const BASE_URL_PROPERTY = 'authentication.oidc.keycloak.url';
const REALM_PROPERTY = 'authentication.oidc.keycloak.realm';
const CLIENT_ID_PROPERTY = 'authentication.oidc.keycloak.clientId';

/**
 * AuthPlugin that redirects the user to the configured keycloak instance.
 */
function Component({
  client,
  onSuccess,
  onFailure,
}: AuthPluginProps): JSX.Element {
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    let isCanceled = false;
    async function login() {
      try {
        var authConfigValues = await client.getAuthConfigValues();
        function getConfig(key) {
          return authConfigValues.filter(config => config[0] === key).map(config => config[1])[0];
        }
        const url = getConfig(BASE_URL_PROPERTY);
        if (url == null) {
            setError('Keycloak server URL not specified by server');
            return;
        }
        var realm = getConfig(REALM_PROPERTY);
        if (realm == null) {
            setError('Keycloak realm not specified by the server');
            return;
        }
        var clientId = getConfig(CLIENT_ID_PROPERTY);
        if (clientId == null) {
            setError('Keycloak clientId not specified by the server');
            return;
        }
        var keycloak = new Keycloak({realm, url, clientId,});
        keycloak.init({pkceMethod:'S256', checkLoginIframe:false,})
            .success(authenticated => {
                log.info('Keycloak api authenticated')
                if (isCanceled) {
                    log.info('Previous login failure canceled');
                    return;
                }
                if (authenticated) {
                    log.info('auth with keycloak successful, authenticating to deephaven...');
                    client.login({type:OIDC_AUTH_TYPE, token:keycloak.token})
                        .then(
                            success => {
                            	if (isCanceled) {
                            	    log.info('Previous login failure canceled');
                            	    return;
                            	}
                                onSuccess();
                            },
                            failure => {
                                log.info("Failed authenticating with deephaven");
                                setError('Failed to authenticate: ' + failure);
                            }
                        );
                } else {
                    log.info('User isn\'t logged in, redirecting to IDP (this may auto-redirect back here again)... Click "Go" again when you return.');
                    keycloak.login({});
                }
            })
                .error(error => setError("Error loading KeyCloak " + error));
       
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
  }, [client, dh, onFailure, onSuccess]);
  return (
    <LoadingOverlay
      data-testid="auth-anonymous-loading"
      isLoading
      isLoaded={false}
      errorMessage={error != null ? `${error}` : null}
    />
  );
}

const AuthPluginKeyCloak: AuthPlugin = {
  Component,
  isAvailable: (client, authHandlers, authConfigValues) =>
    authHandlers.includes(OIDC_AUTH_TYPE),
};

export default AuthPluginKeyCloak;
