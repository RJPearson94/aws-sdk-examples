import { APIGatewayProxyEventV2 } from "aws-lambda";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { AwsClientStub, mockClient } from "aws-sdk-client-mock";
import { handler, NotificationProcessorResponse } from "../../src";

describe("Given I want to save a document in DynamoDB", () => {
  let dynamoDBDocumentClientMock: AwsClientStub<DynamoDBDocumentClient>;

  beforeEach(() => {
    process.env.TABLE_NAME = "TestTable";

    dynamoDBDocumentClientMock = mockClient(DynamoDBDocumentClient);
  });

  afterEach(() => {
    dynamoDBDocumentClientMock.restore();
  });

  describe("When the handler is called", () => {
    let response: NotificationProcessorResponse;

    beforeEach(async () => {
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

      dynamoDBDocumentClientMock.on(PutCommand).resolves({});

      response = await handler(event as APIGatewayProxyEventV2);
    });

    test("Then the document client should have been called once", () => {
      const calls = dynamoDBDocumentClientMock.calls();
      expect(calls.length).toEqual(1);
      expect(calls[0].args?.[0]).toEqual(
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
});
