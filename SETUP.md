# Put the intake form on nimbus-core.com/onboard

The homepage stays on the S3 bucket you already have. These steps add only `/onboard`.

Do every AWS step while the console's region (top right) says **N. Virginia**.

Do not create a new CloudFront distribution. Do not change the Route 53 records. Do not change anything at GoDaddy.

## 1. The code is already on GitHub

https://github.com/rawle-nimbuscore/nimbus-onboard

## 2. Copy your AWS account ID

1. Open the AWS console.
2. Click your account name at the top right.
3. Copy the 12-digit **Account ID**.

## 3. Let GitHub deploy

1. In the search bar, open **IAM**.
2. Left menu: **Identity providers**.
3. **Add provider**.
4. Type: **OpenID Connect**.
5. Provider URL: `https://token.actions.githubusercontent.com`
6. Click **Get thumbprint**.
7. Audience: `sts.amazonaws.com`
8. **Add provider**.

Then the role:

1. Left menu: **Roles** → **Create role**.
2. Trusted entity: **Web identity**.
3. Identity provider: `token.actions.githubusercontent.com`.
4. Audience: `sts.amazonaws.com`.
5. **Next**. On the permissions page, click **Next** without adding a policy.
6. Role name: `nimbus-onboard-deploy`.
7. **Create role**.
8. Open that role. Copy the **ARN**. It looks like `arn:aws:iam::123456789012:role/nimbus-onboard-deploy`.
9. Open the **Trust relationships** tab → **Edit trust policy**.
10. Replace the whole policy with `infra/github-trust-policy.json` from this repo.
11. Replace both `ACCOUNT_ID` values with your 12-digit account ID. Save.

Then what the role is allowed to do:

1. On the same role, **Add permissions** → **Create inline policy**.
2. **JSON** tab.
3. Paste `infra/github-deploy-policy.json`.
4. Replace `ACCOUNT_ID`.
5. Name the policy `nimbus-onboard-ecr-push`. Create it.

## 4. Create the image repository

1. Search **Elastic Container Registry**.
2. **Create repository**.
3. Visibility: **Private**.
4. Name: `nimbus-onboard`.
5. Create it. Leave the URI on screen. It looks like `123456789012.dkr.ecr.us-east-1.amazonaws.com/nimbus-onboard`.

## 5. Give the GitHub workflow the role

1. Open https://github.com/rawle-nimbuscore/nimbus-onboard/settings/secrets/actions
2. **New repository secret**.
3. Name: `AWS_ROLE_ARN`
4. Value: the role ARN from step 3.
5. Add secret.

## 6. Build the first image

1. Open https://github.com/rawle-nimbuscore/nimbus-onboard/actions
2. Click **Deploy**.
3. **Run workflow** → branch **main** → **Run workflow**.
4. Wait until the run is green.
5. Back in ECR, open `nimbus-onboard`. You should see an image tagged `latest`.

If the run is green but says AWS is not connected, the secret name is wrong. It must be exactly `AWS_ROLE_ARN`.

## 7. Run the app

1. Search **App Runner** → **Create service**.
2. Repository type: **Container registry**.
3. Provider: **Amazon ECR**.
4. Browse to `nimbus-onboard`, tag `latest`.
5. Deployment settings: **Automatic**.
6. ECR access role: **Create new service role**.
7. **Next**.
8. Service name: `nimbus-onboard`.
9. Port: `8080`.
10. Add environment variables: `HOST` = `0.0.0.0` and `PORT` = `8080`.
11. Health check: **HTTP**, path `/onboard`.
12. CPU **1 vCPU**, memory **2 GB**.
13. Create. Wait until the status is **Running**.
14. Open the default domain and add `/onboard`. The form should appear. If the health check fails, change the path to `/onboard/` and deploy again.

## 8. Attach it to the existing site

1. Search **CloudFront**.
2. Open the distribution whose alternate domain name is `nimbus-core.com`. Do not create a new one.
3. **Origins** → **Create origin**.
4. Origin domain: the App Runner hostname only, such as `abc123.us-east-1.awsapprunner.com`. No `https://`.
5. Protocol: **HTTPS only**.
6. Name: `nimbus-onboard`.
7. Create origin.
8. **Behaviors** → **Create behavior**.
9. Path pattern: `/onboard*`
10. Origin: `nimbus-onboard`.
11. Viewer protocol: **Redirect HTTP to HTTPS**.
12. Allowed HTTP methods: **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**.
13. Cache policy: **CachingDisabled**.
14. Origin request policy: **AllViewerExceptHostHeader**.
15. Create behavior.
16. On the Behaviors list, the `/onboard*` row must be above the default `*`. If it is not, use **Change priority**.
17. Do not edit the default behavior.
18. Wait until the distribution status is **Deployed**.

## 9. Check both addresses

- https://nimbus-core.com still shows the current homepage.
- https://nimbus-core.com/onboard shows the form.
- Submit one brief. Open the FormSubmit mail at rawle@nimbus-core.com and click **Activate Form** once.

Later releases are a push to `main`. The workflow builds a new image, and App Runner deploys it because automatic deployment is on.
