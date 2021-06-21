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
