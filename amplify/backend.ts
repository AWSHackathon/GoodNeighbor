import { defineBackend } from "@aws-amplify/backend";
import { Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CfnMap } from "aws-cdk-lib/aws-location";
import { auth } from "./auth/resource";

const backend = defineBackend({ auth });

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
