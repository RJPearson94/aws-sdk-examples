import { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler, NotificationProcessorResponse } from "../../src";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

describe("Given I want to save a document in DynamoDB", () => {
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
