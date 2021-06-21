import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
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

let client: DynamoDBDocument | undefined;

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
