# Deploy Your Own Full-Stack Website to AWS

This tutorial packages the Next.js portfolio site and its FastAPI chatbot into one Docker image, then deploys that image to AWS Lambda through Amazon ECR and a Lambda Function URL.

## What You'll Do

- Build a static Next.js frontend with the Pages Router
- Serve the frontend and FastAPI API from one container
- Stream chatbot responses with Server-Sent Events (SSE)
- Use the AWS Lambda Web Adapter to run FastAPI on Lambda
- Store the image in Amazon ECR
- Publish the application through a Lambda Function URL
- Monitor the function with CloudWatch and protect the account with budgets

## Important: Budget Protection First!

AWS charges for resources you use. Set up billing alerts before creating resources. Lambda may remain within its free tier for course-sized usage, but ECR storage, CloudWatch logs, and requests are not guaranteed to cost zero. Check the current [AWS Lambda pricing](https://aws.amazon.com/lambda/pricing/) and [Amazon ECR pricing](https://aws.amazon.com/ecr/pricing/) for your region.

## Understanding AWS Services We'll Use

### AWS Lambda

Lambda runs the container only when the application is invoked. This project is a small **Lambdalith**: FastAPI owns the HTTP routes and also serves the exported Next.js files.

### Lambda Function URLs

A Function URL gives the Lambda function a direct HTTPS endpoint without API Gateway. This tutorial uses the `RESPONSE_STREAM` invoke mode because `/api/chat` sends SSE chunks while the model responds.

### AWS Lambda Web Adapter

The Web Adapter is copied into the image at `/opt/extensions/lambda-adapter`. It translates Lambda requests into HTTP requests for Uvicorn, which listens on port `8000`. The application code stays a normal FastAPI application.

### Amazon ECR

ECR stores the Docker image that Lambda pulls when the function is created or updated.

### IAM and CloudWatch

IAM controls access to AWS resources. CloudWatch receives Lambda logs and exposes invocation, duration, error, and throttle metrics.

## Part 1: Create and Secure Your AWS Account

### Step 1: Sign Up for AWS

1. Visit [aws.amazon.com](https://aws.amazon.com) and create an account.
2. Add a payment method as required by AWS.
3. Select **Basic Support - Free**.

You will use the root account only for account-level security and billing tasks.

### Step 2: Secure the Root Account

1. Sign in to the AWS Console.
2. Open your account menu and choose **Security credentials**.
3. Enable MFA for the root user with an authenticator app.

### Step 3: Set Up Budget Alerts

1. Open **Billing and Cost Management**.
2. Choose **Budgets** and create monthly cost budgets.
3. Useful learning thresholds are `$1`, `$5`, and `$10`.
4. Add an email address for each alert.

If an alert fires, stop and review Lambda invocations, ECR image versions, and CloudWatch log volume.

### Step 4: Create an IAM User for Daily Work

Create an IAM user for the tutorial instead of using the root user for CLI work. Enable console access if you need it, and create a strong password.

### Step 5: Give the User the Required Permissions

For a temporary learning account, attach permissions that allow the workflow below:

- `AWSLambda_FullAccess`
- `AmazonEC2ContainerRegistryFullAccess`
- `CloudWatchLogsFullAccess`
- `IAMUserChangePassword`

Use narrower, resource-scoped policies for a real application. Avoid leaving broad permissions attached after the tutorial.

### Step 6: Configure AWS CLI Access

Install the [AWS CLI](https://aws.amazon.com/cli/), then authenticate using your organization-approved method. For a local learning setup, `aws configure` is available:

```bash
aws configure
```

Use one AWS region consistently for ECR, Lambda, and the CLI. Confirm the credentials work:

```bash
aws sts get-caller-identity
```

## Part 2: Install the Local Tools

Install:

- [Node.js](https://nodejs.org/) 22 or a compatible current release
- [Python](https://www.python.org/) 3.12 or newer
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [AWS CLI](https://github.com/aws/aws-cli/tree/v2?refid=011f28e3-1dfa-405d-894f-3e05b14038a6#installation)

Verify Docker:

```bash
docker --version
docker run hello-world
```

## Part 3: Understand This Project

The application is already prepared as a Next.js static export plus a FastAPI backend:

```text
.
├── pages/
│   ├── _app.tsx
│   └── index.tsx          # portfolio page and chat widget
├── styles/globals.css
├── api/server.py          # FastAPI app and POST /api/chat
├── public/                # browser assets
├── Dockerfile
├── next.config.ts         # output: "export"
├── package.json
├── requirements.txt
└── .gitignore
```

### How the Chat Works

The browser sends this request from `pages/index.tsx`:

```http
POST /api/chat
Content-Type: application/json

{"message":"What projects have you worked on?"}
```

FastAPI validates the message, calls the configured OpenAI-compatible API, and returns `text/event-stream` data. If `OPENAI_API_KEY` is missing or the model request fails, the server returns the fallback contact message instead.

### Configure Local Environment Variables

Create a local `.env` file or export these variables in your shell. Do not commit it:

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=your-model-name
```

`OPENAI_BASE_URL` is optional when using the default provider endpoint. Set `OPENAI_MODEL` to a model supported by your provider whenever `OPENAI_API_KEY` is present. The API client reads these values at runtime. Keep provider keys private and pass them to Docker with `-e` or `--env-file`; do not bake them into the image.

The frontend currently uses placeholder portfolio text and `test@example.com`. Replace those values in `pages/index.tsx` and `api/server.py` before publishing a personal site.

### Step 1: Install JavaScript Dependencies

Run this once from the project root:

```bash
npm install
```

This creates `package-lock.json`. The Dockerfile uses `npm ci`, which requires that lockfile. Keep it with the project for reproducible image builds.

### Step 2: Verify a Local Next.js Build

```bash
npm run build
```

The static export is written to `out/`. It is ignored by Git and copied into the final Docker image by the Dockerfile.

## Part 4: Review the Docker Configuration

The Dockerfile has two stages:

1. `node:22-alpine` installs dependencies and runs `npm run build`.
2. `python:3.12-slim` installs FastAPI dependencies, copies the Lambda Web Adapter, copies the static export into `/app/static`, and starts Uvicorn on port `8000`.

The container exposes:

- `GET /` and static asset routes for the exported site
- `POST /api/chat` for the chatbot
- `GET /health` for a health check

Build the image locally:

```bash
docker build -t lorem-ipsum-app .
```

If you are on Apple Silicon and will deploy an x86_64 Lambda function, build for Lambda's x86_64 architecture:

```bash
docker build --platform linux/amd64 --provenance=false -t lorem-ipsum-app .
```

## Part 5: Build and Test Locally

### Step 1: Run the Container

With a local `.env` file:

```bash
docker run --rm -p 8000:8000 --env-file .env lorem-ipsum-app
```

Or pass only the variables you need:

```bash
docker run --rm -p 8000:8000 \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e OPENAI_BASE_URL="$OPENAI_BASE_URL" \
  -e OPENAI_MODEL="$OPENAI_MODEL" \
  portfolio-app
```

### Step 2: Test the Site and Health Endpoint

Open [http://localhost:8000](http://localhost:8000) in a browser. Check the backend separately:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"healthy"}
```

Open the chat widget and send a message. Without an API key, the fallback response is expected. Stop the container with `Ctrl+C`.

## Part 6: Push the Image to Amazon ECR

### Step 1: Create an ECR Repository

1. Open **Amazon ECR** in the AWS Console.
2. Create a **private** repository named `lorem-ipsum-app`.
3. Use the same region selected for Lambda.

### Step 2: Set Shell Variables

Mac/Linux:

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=123456789012
export ECR_REPOSITORY=lorem-ipsum-app
export IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest"
```

PowerShell:

```powershell
$env:AWS_REGION = "us-east-1"
$env:AWS_ACCOUNT_ID = "123456789012"
$env:ECR_REPOSITORY = "lorem-ipsum-app"
$env:IMAGE_URI = "$env:AWS_ACCOUNT_ID.dkr.ecr.$env:AWS_REGION.amazonaws.com/$env:ECR_REPOSITORY`:latest"
```

Use your real account ID and region. Never put access keys in the README or Dockerfile.

### Step 3: Authenticate, Build, Tag, and Push

```bash
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin \
    "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

docker build --platform linux/amd64 --provenance=false -t portfolio-app .
docker tag portfolio-app:latest "$IMAGE_URI"
docker push "$IMAGE_URI"
```

Confirm that the `latest` image appears in the ECR repository.

## Part 7: Create the Lambda Function

### Step 1: Create the Function from the Image

1. Open **AWS Lambda** in the same region as ECR.
2. Choose **Create function**.
3. Select **Container image**.
4. Function name: `lorem-ipsum-app`.
5. Select the `lorem-ipsum-app:latest` image from ECR.
6. Create the function.

### Step 2: Configure Runtime Settings

In **Configuration > General configuration**, use settings appropriate for this course project:

- Memory: `1024 MB`
- Timeout: up to `300 seconds` for a long model response
- Ephemeral storage: default `512 MB`

In **Configuration > Concurrency**, reserved concurrency of `2` can cap accidental parallel usage. Do not enable Provisioned Concurrency for this tutorial because it charges for idle warm capacity.

### Step 3: Add Runtime Environment Variables

In **Configuration > Environment variables**, add:

```text
OPENAI_API_KEY       your-api-key
OPENAI_BASE_URL      https://api.openai.com/v1
OPENAI_MODEL         your-model-name
AWS_LWA_INVOKE_MODE  response_stream
```

`AWS_LWA_INVOKE_MODE=response_stream` is required for the Lambda Web Adapter to pass the SSE response through as a stream. The application itself reads the first three variables; the adapter reads the fourth.

For production, move API credentials to AWS Secrets Manager or Systems Manager Parameter Store and grant the function role access to only the required secret. Plain environment variables are used here to keep the tutorial short.

### Step 4: Create the Function URL

1. In **Configuration > Function URL**, choose **Create function URL**.
2. Set **Auth type** to `NONE` for this public browser demo.
3. Set **Invoke mode** to `RESPONSE_STREAM`.
4. Leave CORS disabled in the Function URL because FastAPI already adds CORS headers.
5. Save the URL configuration.

`NONE` makes the URL public. The endpoint has no built-in rate limiting or authentication, so do not use this setting unchanged for a production application. Add an authentication layer and a rate-limiting edge service before exposing a real portfolio backend.

### Step 5: Test the Deployed Application

Open the Function URL. The first request may take longer because Lambda must pull and start the image. Confirm:

- The static Next.js page loads.
- `/health` returns `{"status":"healthy"}`.
- The chat widget reaches `/api/chat`.
- Responses arrive progressively when the provider returns a stream.

## Part 8: Monitoring and Debugging

### View Logs

1. Open the Lambda function.
2. Choose the **Monitor** tab.
3. Open the CloudWatch log group, usually `/aws/lambda/lorem-ipsum-app`.
4. Inspect the newest log stream for startup errors and Python tracebacks.

### View Metrics

Review invocations, duration, errors, throttles, and concurrent executions. Set alarms for errors and throttles before treating the endpoint as production-ready.

### Common Issues and Solutions

**Docker reports `npm ci` cannot find a lockfile**

Run `npm install` in the project root and keep the generated `package-lock.json` before building the image.

**Lambda reports `exec format error`**

The image architecture does not match the function architecture. Rebuild with `--platform linux/amd64`, or create the Lambda function for the architecture you built.

**The page loads but chat returns the fallback**

This is expected when `OPENAI_API_KEY` is missing. If the key is present, verify `OPENAI_BASE_URL` and `OPENAI_MODEL`, then inspect CloudWatch logs.

**The response arrives all at once**

Set both the Lambda Web Adapter environment variable `AWS_LWA_INVOKE_MODE=response_stream` and the Function URL invoke mode to `RESPONSE_STREAM`.

**The Function URL returns 502 or 503**

Check CloudWatch for a startup traceback. Confirm the image contains `static/index.html`, the container listens on port `8000`, and the function timeout is long enough.

**The image push is unauthorized**

Verify the CLI identity and authenticate Docker for the exact ECR region and registry:

```bash
aws sts get-caller-identity
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin \
    "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
```

## Part 9: Update the Application

Pushing a new image to ECR does not automatically make an existing Lambda function use it.

### Step 1: Rebuild and Push

```bash
docker build --platform linux/amd64 --provenance=false -t lorem-ipsum-app .
docker tag lorem-ipsum-app:latest "$IMAGE_URI"
docker push "$IMAGE_URI"
```

### Step 2: Update Lambda

Use the Lambda Console to choose the new image, or run:

```bash
aws lambda update-function-code \
  --function-name lorem-ipsum-app \
  --image-uri "$IMAGE_URI" \
  --region "$AWS_REGION"
```

Wait for the function state to return to `Active`, then test the Function URL again. Consider immutable image tags and infrastructure as code for repeatable deployments beyond this tutorial.

## Cost Management

Lambda scales down when idle, but charges can still come from invocations, execution duration, ECR storage, and CloudWatch logs. To limit learning-project costs:

1. Keep the reserved concurrency low while testing.
2. Monitor the budgets created in Part 1.
3. Remove old ECR image versions.
4. Delete the Lambda function and ECR repository when finished.

As an emergency stop, set reserved concurrency to `0` or delete the Lambda function. Also check ECR and CloudWatch because deleting Lambda alone does not remove stored images or logs.

## What You've Accomplished

You have:

- Built a static Next.js site and FastAPI backend into one image.
- Tested the image locally on port `8000`.
- Stored the image in ECR.
- Deployed it to Lambda with the Lambda Web Adapter.
- Exposed it through a Function URL with response streaming.
- Added basic budget, logging, and debugging practices.

## Architecture Comparison: Local vs AWS Lambda

**Local development**

- Docker starts Uvicorn directly.
- FastAPI serves `static/` and `/api/chat`.
- The app is available at `http://localhost:8000`.

**AWS deployment**

- ECR stores the image.
- Lambda starts the image on demand.
- The Web Adapter translates Lambda requests to Uvicorn.
- FastAPI serves the same frontend and API routes.
- A Function URL provides HTTPS access.

## Next Steps

For a production version, consider:

1. Use AWS Secrets Manager or Parameter Store for provider credentials.
2. Add authentication and request rate limiting.
3. Put CloudFront or API Gateway in front of the public endpoint when you need WAF, custom domains, or more control.
4. Add structured logs, CloudWatch alarms, and log retention.
5. Manage ECR, Lambda, IAM, and the Function URL with CDK, SAM, or CloudFormation.
6. Add CI/CD to build, scan, push, and deploy immutable image tags.

## Resources

- [AWS Lambda container images](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
- [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter)
- [Lambda Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
- [Lambda response streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)
- [Amazon ECR user guide](https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html)
- [AWS Lambda best practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
