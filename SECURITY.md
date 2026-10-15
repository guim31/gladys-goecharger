# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **Stored**: nothing in `/data`. The configuration (charger addresses,
  refresh interval, language, and the optional go-e cloud serial number and
  API token) is kept by Gladys; the token is a `secret` field.
- **Secrets**: the go-e cloud API token is sent only to `*.api.v3.go-e.io`, in
  the `Authorization` header, and never written to the logs.
- **Network**: plain HTTP to the chargers' local API v2 on the addresses the
  user entered (the go-e API has no authentication nor TLS locally), and HTTPS
  to the go-e cloud when it is configured. Nothing else.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
the go-e chargers, their firmware and the go-e cloud.
