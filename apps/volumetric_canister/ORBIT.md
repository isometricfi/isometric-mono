# Orbit Deployment Runbook

This runbook covers the local Orbit setup, the asset canister used for WASM
staging, deployer permissions, cycles monitoring, and the commands used to
request governed upgrades.

## Mental Model

- `volumetric_stage` and `volumetric_prod` are the governed application
  canisters.
- `volumetric_orbit_assets` is a helper asset canister used by `dfx-orbit` to
  stage WASM chunks before creating an Orbit request.
- The Orbit station controls whether the target application canister is
  upgraded.
- The deployer identity controls whether WASM chunks can be uploaded to the
  asset canister.

## Current Canisters

```text
volumetric_orbit_assets  vyjg3-raaaa-aaaae-qkaqq-cai
volumetric_stage         5optx-3iaaa-aaaae-qjwsa-cai
volumetric_prod          ro56e-yyaaa-aaaae-qkaia-cai
```

The Orbit station used by the Makefile is named `isometric`.

```text
isometric station        qa6bz-wyaaa-aaaac-be2fq-cai
```

## Add The Orbit Station Locally

Get the station canister ID from the Orbit UI. Orbit may label this as the
wallet ID.

```bash
dfx-orbit station add isometric \
  --station-id qa6bz-wyaaa-aaaac-be2fq-cai \
  --network ic
```

Verify the local station config:

```bash
dfx-orbit station list
dfx-orbit -s isometric station show
dfx-orbit -s isometric me
```

## Create The Orbit Asset Canister

The helper asset canister is defined in `dfx.json`:

```json
"volumetric_orbit_assets": {
  "type": "assets",
  "source": ["assets/orbit_store"]
}
```

Create the source directory and add a placeholder file:

```bash
mkdir -p assets/orbit_store
printf "This asset canister exists to stage WASM chunks for dfx-orbit upgrades.\n" \
  > assets/orbit_store/README.txt
```

Create and deploy the asset canister:

```bash
dfx canister create volumetric_orbit_assets --network ic
dfx deploy volumetric_orbit_assets --network ic
dfx canister id volumetric_orbit_assets --network ic
```

Expected canister ID:

```text
vyjg3-raaaa-aaaae-qkaqq-cai
```

## Asset Security Policy

Add `assets/orbit_store/.ic-assets.json5`:

```json5
[
  {
    "match": "**/*",
    "security_policy": "standard",
    "allow_raw_access": false
  }
]
```

Apply the policy:

```bash
dfx deploy volumetric_orbit_assets --network ic
```

`security_policy: "standard"` applies the standard asset-canister security
headers. `allow_raw_access: false` disables uncertified raw gateway access.

## Local Deployer Identity

Check the active identity and principal before granting permissions:

```bash
dfx identity whoami
dfx identity get-principal
```

Grant the deployer `Prepare` permission so `dfx-orbit` can upload WASM chunks:

```bash
dfx canister call volumetric_orbit_assets grant_permission \
  '(record { to_principal = principal "<deploy-principal>"; permission = variant { Prepare } })' \
  --network ic
```

If the upload later fails at commit time, also grant `Commit`:

```bash
dfx canister call volumetric_orbit_assets grant_permission \
  '(record { to_principal = principal "<deploy-principal>"; permission = variant { Commit } })' \
  --network ic
```

This permission is set on the asset canister, not in Orbit.

## Controllers

Add a backup/admin controller to the asset canister if needed:

```bash
dfx canister update-settings volumetric_orbit_assets \
  --network ic \
  --add-controller <backup-principal>
```

Verify controllers and cycle balance:

```bash
dfx canister status volumetric_orbit_assets --network ic
```

The Orbit station does not need to be a controller of the asset canister for
WASM staging. Orbit only needs permission over the governed target canister.

## Cycles And CycleOps

The asset canister needs cycles to stay running and accept uploads.

Check status:

```bash
dfx canister status volumetric_orbit_assets --network ic
```

Check local cycles ledger balance:

```bash
dfx cycles balance --network ic
```

Convert ICP to cycles if needed:

```bash
dfx cycles convert --amount 0.5 --network ic
```

Top up the asset canister:

```bash
dfx canister deposit-cycles <cycles-amount> volumetric_orbit_assets --network ic
```

For CycleOps:

1. Open the CycleOps dashboard and choose add canister.
2. Add `volumetric_orbit_assets` with ID
   `vyjg3-raaaa-aaaae-qkaqq-cai`.
3. Add the CycleOps balance checker as a controller when prompted.
4. Verify in CycleOps that monitoring and top-ups are active.

CycleOps requires that you control the canister. A canister already added by
another principal cannot be added again by a different principal.

## Direct Deploy

Direct deploy remains available through `make deploy`.

```bash
make release
make deploy TARGET=stage
```

This runs:

```bash
dfx canister install volumetric_stage \
  --network ic \
  --mode upgrade \
  --wasm volumetric.wasm \
  --yes
```

Use direct deploy only when bypassing Orbit is intentional.

## Orbit Deploy

Use `make orbit-deploy` for governed upgrades:

```bash
make release
make orbit-deploy TARGET=stage
```

The Makefile runs:

```bash
dfx-orbit -s isometric request canister install \
  --mode upgrade \
  --wasm volumetric.wasm \
  --asset-canister volumetric_orbit_assets \
  volumetric_stage
```

After the command succeeds, the upgrade is not installed immediately. It creates
an Orbit request that must be approved and executed by the configured Orbit
policy.

## Common Errors

`Caller does not have Prepare permission`

The deployer identity does not have asset-canister upload permission. Grant
`Prepare` on `volumetric_orbit_assets`.

`Unauthorized access to resources: ExternalCanister(Change(...))`

Orbit does not authorize the caller to request changes for the target canister.
Update Orbit permissions for the user or group that should propose upgrades.

`Cannot find canister id`

The local `canister_ids.json` does not contain the IC mapping. Run:

```bash
dfx canister id volumetric_orbit_assets --network ic
```

If it does not exist yet, create it:

```bash
dfx canister create volumetric_orbit_assets --network ic
```
