import { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler, NotificationProcessorResponse } from "../src";

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

jest.mock("aws-xray-sdk-core");

describe("Given I want to save a document in DynamoDB", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "TestTable";
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

      mockPromise.mockResolvedValue({});

      response = await handler(event as APIGatewayProxyEventV2);
    });

    test("Then the document client put function should have been called once", () => {
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
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
