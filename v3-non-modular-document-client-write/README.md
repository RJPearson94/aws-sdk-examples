# AWS SDK v3 (non-modular)

This example uses the non-modular (v2 style) implementation of version 3 of the AWS JS SDK. This example has a suite of tests that use Jest's mock function to mock out any requests to DynamoDB and AWS X-Ray.

The non-modular implementation should technically result in larger bundle sizes as tree-shaking won't be as effective, so AWS recommend you use the [modular implementation](../v2-document-client-write) instead.

This project uses Yarn 2. See the [docs](https://yarnpkg.com/getting-started/install) for installation instructions

## Useful Commands

- `yarn install` - Install dependencies
- `yarn build` - Create an artefact that can be uploaded to the lambda service (uses esbuild and yazl)
- `yarn test` - Run the Jest tests
