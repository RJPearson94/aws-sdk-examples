# AWS SDK v2

This example uses the version 2 AWS JS SDK. This example uses Jest's mock function to mock out any requests to DynamoDB and AWS X-Ray during testing

This project uses Yarn 2. See the [docs](https://yarnpkg.com/getting-started/install) for installation instructions

## Useful Commands

- `yarn install` - Install dependencies
- `yarn build` - Create an artefact that can be uploaded to the lambda service (uses esbuild and yazl)
- `yarn test` - Run the Jest tests
