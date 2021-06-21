# AWS SDK v3

This example uses version 3 AWS JS SDK. This example has a suite of tests that use Jest's mock function to mock out any requests to DynamoDB and AWS X-Ray. There is also an example using [aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock) to mock out just the DynamoDB Document Client. Both test suites can be found in the test folder

This project uses Yarn 2. See the [docs](https://yarnpkg.com/getting-started/install) for installation instructions

## Useful Commands

- `yarn install` - Install dependencies
- `yarn build` - Create an artefact that can be uploaded to the lambda service (uses esbuild and yazl)
- `yarn test` - Run the Jest tests
