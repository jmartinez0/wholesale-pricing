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
        /* -----------------------------------------------
         * 1. Ensure metafield definitions
         * --------------------------------------------- */
        const definitions = [
          {
            name: "Wholesale Price",
            namespace: "wholesale",
            key: "price",
            type: "money",
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

          if (json.errors) {
            console.error("GraphQL error creating metafield:", json.errors);
            continue;
          }

          const errors = json.data.metafieldDefinitionCreate.userErrors;
          if (errors.length > 0) {
            console.log(`Metafield "${def.key}" exists or can't be created:`, errors);
          } else {
            console.log(`Metafield created: ${def.key}`);
          }
        }

        /* -----------------------------------------------
         * 2. Check for wholesale discount via functionHandle
         * --------------------------------------------- */
        const checkQuery = `
          query {
            discountNodes(
              query: "functionHandle:'wholesale-discount'"
              first: 1
            ) {
              nodes {
                id
                discount {
                  ... on DiscountAutomaticApp {
                    functionHandle
                  }
                }
              }
            }
          }
        `;

        const checkRes = await admin.graphql(checkQuery);
        const checkJson = await checkRes.json();

        if (checkJson.errors) {
          console.error("GraphQL error checking discounts:", checkJson.errors);
          return;
        }

        const nodes = checkJson.data.discountNodes.nodes;

        const exists = nodes.some(
          n => n.discount?.functionHandle === "wholesale-discount"
        );

        if (exists) {
          console.log("Wholesale Pricing automatic discount already exists.");
          return;
        }

        /* -----------------------------------------------
         * 3. Create automatic wholesale discount
         * --------------------------------------------- */
        const startsAt = new Date().toISOString();

        const createMutation = `
          mutation CreateWholesaleDiscount($startsAt: DateTime!) {
            discountAutomaticAppCreate(
              automaticAppDiscount: {
                title: "Wholesale Pricing"
                functionHandle: "wholesale-discount"
                discountClasses: [PRODUCT]
                startsAt: $startsAt
                combinesWith: {
                  productDiscounts: false
                  orderDiscounts: false
                  shippingDiscounts: false
                }
              }
            ) {
              automaticAppDiscount {
                id
                title
                functionHandle
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const createRes = await admin.graphql(createMutation, {
          variables: { startsAt }
        });

        const createJson = await createRes.json();

        if (createJson.errors) {
          console.error("GraphQL errors creating discount:", createJson.errors);
          return;
        }

        const payload = createJson.data?.discountAutomaticAppCreate;

        if (!payload) {
          console.error("Unexpected response creating discount:", createJson);
          return;
        }

        if (payload.userErrors.length > 0) {
          console.error("Failed to create Wholesale Pricing discount:", payload.userErrors);
        } else {
          console.log("Wholesale Pricing discount created:", payload.automaticAppDiscount);
        }

      } catch (err) {
        console.error("Error in afterAuth wholesale setup:", err);
      }
    },
  }

});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
