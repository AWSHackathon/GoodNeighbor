import { defineBackend } from "@aws-amplify/backend";
import { RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  AttributeType,
  BillingMode,
  Table,
} from "aws-cdk-lib/aws-dynamodb";
import { Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CfnMap } from "aws-cdk-lib/aws-location";
import { auth } from "./auth/resource";
import { apiFunction } from "./functions/api/resource";

const backend = defineBackend({
  auth,
  apiFunction,
});

// --- DynamoDB single-table (profiles + future entities) ---
const dataStack = backend.createStack("data-stack");

const table = new Table(dataStack, "GoodNeighborTable", {
  tableName: "GoodNeighbor",
  partitionKey: { name: "PK", type: AttributeType.STRING },
  sortKey: { name: "SK", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});

table.addGlobalSecondaryIndex({
  indexName: "GSI1",
  partitionKey: { name: "GSI1PK", type: AttributeType.STRING },
  sortKey: { name: "GSI1SK", type: AttributeType.STRING },
});

backend.apiFunction.addEnvironment("TABLE_NAME", table.tableName);
table.grantReadWriteData(backend.apiFunction.resources.lambda);

// --- HTTP API (Cognito JWT) ---
const apiStack = backend.createStack("api-stack");

const userPoolAuthorizer = new HttpUserPoolAuthorizer(
  "CognitoAuthorizer",
  backend.auth.resources.userPool,
  {
    userPoolClients: [backend.auth.resources.userPoolClient],
  },
);

const httpLambdaIntegration = new HttpLambdaIntegration(
  "ApiLambdaIntegration",
  backend.apiFunction.resources.lambda,
);

const httpApi = new HttpApi(apiStack, "GoodNeighborHttpApi", {
  apiName: "GoodNeighborHttpApi",
  corsPreflight: {
    allowMethods: [
      CorsHttpMethod.GET,
      CorsHttpMethod.POST,
      CorsHttpMethod.PUT,
      CorsHttpMethod.OPTIONS,
    ],
    allowOrigins: ["*"],
    allowHeaders: ["Authorization", "Content-Type"],
  },
  createDefaultStage: true,
});

const authRoutes = [
  { path: "/profiles/me", methods: [HttpMethod.GET, HttpMethod.PUT] },
  { path: "/requests", methods: [HttpMethod.GET, HttpMethod.POST] },
  { path: "/leaderboard", methods: [HttpMethod.GET] },
];

for (const route of authRoutes) {
  httpApi.addRoutes({
    path: route.path,
    methods: route.methods,
    integration: httpLambdaIntegration,
    authorizer: userPoolAuthorizer,
  });
}

httpApi.addRoutes({
  path: "/{proxy+}",
  methods: [HttpMethod.ANY],
  integration: httpLambdaIntegration,
  authorizer: userPoolAuthorizer,
});

// --- Amazon Location map ---
const geoStack = backend.createStack("geo-stack");

const map = new CfnMap(geoStack, "GoodNeighborMap", {
  mapName: "GoodNeighborMap",
  description: "Good Neighbor neighborhood assistance map",
  configuration: {
    style: "VectorEsriNavigation",
  },
  pricingPlan: "RequestBasedUsage",
});

const geoPolicy = new Policy(geoStack, "GoodNeighborGeoPolicy", {
  policyName: "GoodNeighborGeoPolicy",
  statements: [
    new PolicyStatement({
      actions: [
        "geo:GetMapTile",
        "geo:GetMapSprites",
        "geo:GetMapGlyphs",
        "geo:GetMapStyleDescriptor",
      ],
      resources: [map.attrArn],
    }),
  ],
});

backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(geoPolicy);
backend.auth.resources.unauthenticatedUserIamRole.attachInlinePolicy(geoPolicy);

backend.addOutput({
  custom: {
    API: {
      GoodNeighborHttpApi: {
        endpoint: httpApi.url,
        region: Stack.of(httpApi).region,
        apiName: httpApi.httpApiName,
      },
    },
    data: {
      tableName: table.tableName,
    },
  },
  geo: {
    aws_region: geoStack.region,
    maps: {
      items: {
        [map.mapName!]: {
          style: "VectorEsriNavigation",
        },
      },
      default: map.mapName!,
    },
  },
});
