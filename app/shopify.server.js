import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),

  hooks: {
    afterAuth: async ({ admin }) => {
      try {
        const definitions = [
          {
            name: "Wholesale Price",
            namespace: "wholesale",
            key: "price",
            type: "number_decimal",
            ownerType: "PRODUCTVARIANT",
            access: { storefront: "PUBLIC_READ" },
          },
          {
            name: "Wholesale Minimum Quantity",
            namespace: "wholesale",
            key: "minimum_quantity",
            type: "number_integer",
            ownerType: "PRODUCTVARIANT",
            access: { storefront: "PUBLIC_READ" },
          },
        ];

        const metafieldMutation = `
          mutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
            metafieldDefinitionCreate(definition: $definition) {
              createdDefinition { id name key namespace }
              userErrors { field message }
            }
          }
        `;

        for (const def of definitions) {
          const res = await admin.graphql(metafieldMutation, {
            variables: { definition: def },
          });
          const json = await res.json();

          const errors = json?.data?.metafieldDefinitionCreate?.userErrors ?? [];
          if (errors.length > 0) {
            console.log(
              `Metafield "${def.key}" exists or cannot be created:`,
              errors
            );
          } else {
            console.log(`Metafield created: ${def.key}`);
          }
        }

        const checkQuery = `
          query {
            discountNodes(query: "title:'Wholesale Discount'", first: 5) {
              nodes {
                id
                discount {
                  __typename
                  ... on DiscountAutomaticApp {
                    title
                    status
                  }
                }
              }
            }
          }
        `;

        const checkRes = await admin.graphql(checkQuery);
        const checkJson = await checkRes.json();

        if (checkJson.errors?.length) {
          console.error(
            "Error querying for existing Wholesale Discount:",
            checkJson.errors
          );
        }

        const nodes = checkJson?.data?.discountNodes?.nodes ?? [];
        const exists = nodes.some(
          (n) => n.discount?.title === "Wholesale Discount"
        );

        if (exists) {
          console.log("Wholesale Discount automatic discount already exists.");
          return;
        }

        const FUNCTION_HANDLE = "wholesale-discount";

        const createMutation = `
          mutation discountAutomaticAppCreate(
            $automaticAppDiscount: DiscountAutomaticAppInput!
          ) {
            discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
              automaticAppDiscount {
                discountId
                title
                status
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const startsAt = new Date(Date.now() + 5000).toISOString();

        const automaticAppDiscount = {
          title: "Wholesale Discount",
          functionHandle: FUNCTION_HANDLE,
          discountClasses: ["PRODUCT"],
          startsAt,
          combinesWith: {
            productDiscounts: false,
            orderDiscounts: false,
            shippingDiscounts: false,
          },
        };

        const createRes = await admin.graphql(createMutation, {
          variables: { automaticAppDiscount },
        });

        const createJson = await createRes.json();

        console.dir(createJson, { depth: null });

        if (createJson.errors?.length) {
          console.error(
            "GraphQL-level errors from discountAutomaticAppCreate:",
            createJson.errors
          );
          return;
        }

        const payload = createJson.data?.discountAutomaticAppCreate;

        if (!payload) {
          console.error(
            "discountAutomaticAppCreate returned no data. Full response:",
            createJson
          );
          return;
        }

        if (payload.userErrors.length > 0) {
          console.error(
            "Failed to create Wholesale Discount (userErrors):",
            payload.userErrors
          );
        } else {
          console.log(
            "Wholesale Discount created successfully:",
            payload.automaticAppDiscount
          );
        }
      } catch (err) {
        console.error("Error in afterAuth wholesale setup:", err);
      }
    },
  },
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;