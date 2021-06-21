# AWS SDK JS V3

At AWS re:Invent 2020, I saw Alex Casaboni talk about optimizing your lambda function performance [1]. During the presentation [2], Alex highlighted a blog post [3] from Yan Cui (also known as the burning monk) in which he ran a few experiments to determine how your dependency usage can impact the performance of your application.

When kicking off a new backend project, I had this talk and blog post in the back of my mind; with the new modular AWS SDK JS V3 hitting general availability back in December 2020, I decided to give it a go. This post will outline my thoughts and opinions on using the new SDK.

## What is new

Having spent the last few years of my career; developing application using TypeScript, I was excited to see first-class TypeScript support in V3. TypeScript's popularity in recent years has grown, now with over 76 million weekly downloads on NPM. Static typing is one of the benefits of using TypeScript over plain JavaScript however this can be one of its pain points. The number of libraries that I have come across which have either no or incorrect type definitions for the code is significant and makes working with TypeScript frustrating. With the SDK having first-class TypeScript support, this is no longer a concern.

Version 3 added support for middleware to allow you to manipulate a request as it traverses the middleware stack and sent to an AWS service API. In the README of the SDK [4], there is an example that shows a custom header added to the HTTP request.
So far, I haven't found a use case for this however seeing some of the uses of middleware in lambda functions via Middy [5][6], this feature could be helpful.

HTTP keep-alive is on by default. Having used version 2 of the AWS SDK on many projects, its varying response time was a great source of frustration. Only to later realise that I had forgotten to enable HTTP keep-alive resulting in new connections for every request. So it is great to see this enabled by default on version 3. In an AWS Developer Blog post by Trivikram Kamat [7] highlights that on 100 requests to `DynamoDB.listTables` the code was ~60% faster when HTTP keep-alive was on vs being off.

The SDK now has built-in paginator functions [8], eliminating the need to write and maintain custom code for interacting with a paginated AWS operation. These paginator functions use async generator functions to allow you to retrieve numerous pages of results. See the README of the SDK [8] for examples

## Show me the code

In the example below, I have 2 TypeScript lambda functions. These functions are both invoked by an AWS API Gateway V2 using the lambda proxy integration and use the Document client to save data into a DynamoDB.

The first example shows version 2 of the AWS SDK.

```code
import DynamoDB, { DocumentClient } from "aws-sdk/clients/dynamodb";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { v4 } from "uuid";
import { captureAWSClient } from "aws-xray-sdk-core";

export type NotificationEvent = {
  channel: "sms";
  to: string;
  body: string;
  metadata?: {
    [key: string]: any;
  };
};

export type NotificationProcessorResponse = {
  id: string;
};

let client: DocumentClient | undefined;

export const handler = async ({ body }: APIGatewayProxyEventV2): Promise<NotificationProcessorResponse> => {
  client = client || new DocumentClient({
    service: new DynamoDB(),
  });
  captureAWSClient((client as any).service);

  const currentDateTime = new Date().toISOString();
  const id = v4();

  await client
    .put({
      TableName: process.env.TABLE_NAME,
      Item: {
        ...(JSON.parse(body) as NotificationEvent),
        notificationId: id,
        deliveryStatus: "received",
        createdDate: currentDateTime,
        updatedDate: currentDateTime,
      },
      ReturnValues: "NONE",
    })
    .promise();

  return {
    id,
  };
};
```

The following example shows a version 3 implementation.

```code
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { captureAWSv3Client } from "aws-xray-sdk-core";
import { v4 } from "uuid";

export type NotificationEvent = {
  channel: "sms";
  to: string;
  body: string;
  metadata?: {
    [key: string]: any;
  };
};

export type NotificationProcessorResponse = {
  id: string;
};

let client: DynamoDBDocumentClient | undefined;

export const handler = async ({ body }: APIGatewayProxyEventV2): Promise<NotificationProcessorResponse> => {
  client = client || captureAWSv3Client(DynamoDBDocumentClient.from(new DynamoDBClient({})));

  const currentDateTime = new Date().toISOString();
  const id = v4();

  await client.send(
    new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: {
        ...(JSON.parse(body) as NotificationEvent),
        notificationId: id,
        deliveryStatus: "received",
        createdDate: currentDateTime,
        updatedDate: currentDateTime,
      },
      ReturnValues: "NONE",
    })
  );

  return {
    id,
  };
};
```

If you want to retain the v2 style (non-modular interface) of calling the operation name, you can use the service name without the client suffix i.e. `DynamoDBDocument` or `DynamoDB` instead. Below is an example of putting/ saving data into DynamoDB using the non-modular interface

```code
...
export const handler = async ({
  body,
}: APIGatewayProxyEventV2): Promise<NotificationProcessorResponse> => {
  client =
    client || captureAWSv3Client(DynamoDBDocument.from(new DynamoDB({})));

  const currentDateTime = new Date().toISOString();
  const id = v4();

  await client.put({
    TableName: process.env.TABLE_NAME,
    Item: {
      ...(JSON.parse(body) as NotificationEvent),
      notificationId: id,
      deliveryStatus: "received",
      createdDate: currentDateTime,
      updatedDate: currentDateTime,
    },
    ReturnValues: "NONE",
  });

  return {
    id,
  };
};
```

According to the AWS documentation, using the non-modular interface will lead to larger bundle sizes as tree-shaking won't be as effective. A quick investigation using esbuild (version 0.12.1) and version 3.17.0 of the `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` dependencies produced the same bundle size regardless of the interface used. An update of this blog post will follow when I get to the root cause of this.

## How about testing

When testing an application, there is no one size fits approach. How you test can be dictated by the testing framework, code structure and more.

My testing and mocking framework of choice is Facebook's Jest. When writing unit or integration tests for my applications, I need to mock the AWS SDK. In Jest, there are two ways to do this you can either use the spy on function or the mock function. An article from Rick Hanlon II [9] explains the use cases and the differences.

For Version 2 of the AWS SDK, I tend to opt for the mock function approach. The snippet below shows how to mock the document client put method

```code
let mockPromise = jest.fn();

let mockPut = jest.fn(() => ({
  promise: mockPromise,
}));

jest.mock("aws-sdk/clients/dynamodb", () => ({
  __esModule: true,
  default: jest.fn(),
  DocumentClient: jest.fn(() => ({
    put: mockPut,
  })),
}));
```

In comparison, when I use the modular interface in version 3 of the SDK, I tend to use the spy on function instead as I only need to stub out the send function. Below is a snippet showing how to spy on the send function on the Dynamo DB Document Client

```code
jest
  .spyOn(DynamoDBDocumentClient.prototype, "send")
  .mockImplementation(() => Promise.resolve());
```

Below you can see a full Jest test suite for the AWS SDK V3 lambda example above

```code
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler, NotificationProcessorResponse } from "../../src";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

describe("Given I want to save data in DynamoDB", () => {
  describe("When the handler is called", () => {
    let response: NotificationProcessorResponse;
    let spiedSend: jest.SpyInstance;

    // Ideally this should be a before all but jest clears the mocks down before each test and I don't want to disable that functionality
    beforeEach(async () => {
      process.env.TABLE_NAME = "TestTable";

      const event: Partial<APIGatewayProxyEventV2> = {
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          channel: "sms",
          to: "+441234567890",
          body: "Hello World",
        }),
      };

      spiedSend = jest
        .spyOn(DynamoDBDocumentClient.prototype, "send")
        .mockImplementation(() => Promise.resolve());

      response = await handler(event as APIGatewayProxyEventV2);
    });

    test("Then the put command should have been called once", () => {
      expect(spiedSend).toHaveBeenCalledWith(expect.any(PutCommand));
      expect(spiedSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: "TestTable",
            Item: expect.objectContaining({
              channel: "sms",
              to: "+441234567890",
              body: "Hello World",
              notificationId: expect.any(String),
              deliveryStatus: "received",
              createdDate: expect.any(String),
              updatedDate: expect.any(String),
            }),
            ReturnValues: "NONE",
          },
        })
      );
    });

    test("Then the response should contain the record ID", () => {
      expect(response).toEqual(
        expect.objectContaining({
          id: expect.any(String),
        })
      );
    });
  });

  describe("When the document client throws an error", () => {
    const error = new Error("An error has occurred");
    let testSubject: () => Promise<NotificationProcessorResponse>;

    beforeEach(async () => {
      process.env.TABLE_NAME = "TestTable";

      const event: Partial<APIGatewayProxyEventV2> = {
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          channel: "sms",
          to: "+441234567890",
          body: "Hello World",
        }),
      };

      jest
        .spyOn(DynamoDBDocumentClient.prototype, "send")
        .mockImplementation(() => Promise.reject(error));

      testSubject = () => handler(event as APIGatewayProxyEventV2);
    });

    test("Then the promise should reject with the error", () => {
      expect(testSubject).rejects.toThrowError(error);
    });
  });
});
```

During my investigation on strategies for mocking V3 SDK, I stumbled across `aws-sdk-client-mock` [10] which uses Sinon.js and fluent interfaces to mock the SDK.
I like this solution when working with multiple commands or when you need to return different stubbed data for a specific request but if I am only interacting with one command I will use the spyOn approach.

## So what are the downsides

If you are using AWS lambda, V3 is not available on any of the AWS managed runtimes.
As a result, you will have to do one of the following if you want to use version 3 of the SDK:

- bundle the clients and libraries into your zip
- create a lambda layer [11] and attach it to your function
- build a custom lambda runtime [12] with the clients and libraries baked-in

Bundling the dependencies into the zip has the lowest maintenance & technical effort out of the three options; it would be the one I choose. If you previously used the AWS SDK on the runtime i.e. due to limits, performance, etc. and in a similar position with version 3. Then you either have to choose another option or stick with version 2 of the SDK.

To the best of my knowledge AWS, hasn't indicated if they will include the version 3 SDK into future lambda runtimes. I am doubtful as I suspect they will either produce layers for the SDK that you can attach to your runtime or make you include the SDK in whatever way you choose.
If AWS choose the latter option, it will be interesting to see if they will raise the layer limit and/ or zip limit (possibly lambda storage limit too) to accommodate this additional code. Hopefully, we should find out soon as node 16 hits LTS later this year. So we may see node 16 lambda runtime support this year too.

Since hitting GA, version 3 has seen a few issues raised against its Github repo for missing service client. These issues highlight that version 3 of the SDK does not currently have feature parity with version 2. In recent releases of the version 3 SDK, the gaps in functionality have started to close but, there may still be some clients and utilities missing.

When developing applications, we don't want to reinvent the wheel. We often rely on 3rd party libraries to do a lot of the heavy lifting for us. When a new major release of a widely used SDK (version 2 of the AWS SDK has 29 million weekly downloads from NPM) is released, adoption across all the libraries and tools can be slow. Some library makers may go for a big bang approach on day 1 of GA, others may opt for a more phased migration and some libraries may reach the end of life.
Until AWS announce the end of support of version 2 of the SDK, we may be stuck in limbo and having to choose which SDK to use on a per-project basis. Some projects may even use both SDKs in the same application. While we are waiting for clarity on if version 3 of the SDK will be in future lambda runtimes, some library makers will take their time with switching over.

## So should I convert my V2 projects to V3?

In short, it depends.

I have seen some libraries have started adopting or have been testing the waters with the new SDK. For me, this will be the catalyst for mass adoption. When the libraries that we all love and depend on every day migrate to the V3 of the SDK and start to unlock/ harness the new features and functionality on offer, we will all start to reap the benefits.

Ultimately, AWS will announce the V2 JS SDK will enter maintenance mode and eventually not be supported anymore. When that is, I'm not sure as there is no indication at the time of writing.
So you will probably have to migrate at some point to continue receiving security/ patch updates. In some scenarios, you may choose to retire the application(s) instead.

The question is, do you stay ahead of the curve and take the leap or wait it out and see what happens when the dust settles? Only you can answer that.

## Closing comments

With the SDK being GA for less than a year, all I will say is it's still early days. When I first looked at V3 of the SDK just after it went GA, there was no DocumentClient library and no AWS X-Ray support. These were a blocker for me adopting it; the teams at AWS and the wider community have done some great work to overcome these obstacles. As more libraries pivot to version 3 of the SDK and start to use it in ways we never imagined, I think we will see the new SDK shine.

This blog post has focused on using the AWS SDK for a backend project; there may be additional benefits/ use cases when using the application in react native or frontend applications that I haven't explored.

In closing, when starting a brand new JavaScript/ TypeScript project/ application, I would use V3 of the SDK from day 1, as there is little benefit to adopting legacy from the start as the learning curve isn't that steep.
If you have an existing application or rely on a library that uses V2 of the SDK, then using V2 is fine. Just make sure you have a ticket/ issue to track the adoption of V3, as you will have to migrate eventually.

Thanks for reading

## Links

[1] Part 2: Optimizing your Lambda function performance - https://youtu.be/rrK7PA8ZK7M

[2] Optimizing dependency usage - https://youtu.be/rrK7PA8ZK7M?t=835

[3] https://theburningmonk.com/2019/03/just-how-expensive-is-the-full-aws-sdk/)

[4] https://github.com/aws/aws-sdk-js-v3#middleware

[5] https://github.com/middyjs/middy

[6] I have used Middy to modify the behaviour of a lambda function by manipulating the request and response payload i.e. converting an object into a lambda proxy event response. I have also used Middy to perform additional processing on a request or response i.e. retrieving a secret from AWS Secrets Manager or deleting processed messages from an SQS queue

[7] https://aws.amazon.com/blogs/developer/http-keep-alive-is-on-by-default-in-modular-aws-sdk-for-javascript/

[8] https://github.com/aws/aws-sdk-js-v3#paginators

[9] https://medium.com/@rickhanlonii/understanding-jest-mocks-f0046c68e53c#:~:text=mock%20does%20this%20automatically%20for,allows%20restoring%20the%20original%20function

[10] https://github.com/m-radzikowski/aws-sdk-client-mock

[11] https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html

[12] https://docs.aws.amazon.com/lambda/latest/dg/runtimes-custom.html
