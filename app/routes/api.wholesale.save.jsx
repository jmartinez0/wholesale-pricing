import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    const { updates } = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No updates provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const toSave = [];
    const toDelete = [];

    for (const { variantId, value, minimumQuantity } of updates) {
      const trimmedPrice = String(value ?? "").trim();

      if (trimmedPrice === "" || trimmedPrice.toLowerCase() === "null") {
        toDelete.push({
          ownerId: variantId,
          namespace: "wholesale",
          key: "price",
        });
      } else {
        const num = parseFloat(trimmedPrice);
        if (!isNaN(num)) {
          toSave.push({
            ownerId: variantId,
            namespace: "wholesale",
            key: "price",
            type: "money",
            value: num.toFixed(2),
          });
        }
      }

      const trimmedQty = String(minimumQuantity ?? "").trim();

      if (trimmedQty === "" || trimmedQty.toLowerCase() === "null") {
        toDelete.push({
          ownerId: variantId,
          namespace: "wholesale",
          key: "minimum_quantity",
        });
      } else {
        const qtyNum = parseInt(trimmedQty, 10);
        if (!isNaN(qtyNum)) {
          toSave.push({
            ownerId: variantId,
            namespace: "wholesale",
            key: "minimum_quantity",
            type: "number_integer",
            value: qtyNum.toString(),
          });
        }
      }
    }

    const results = { saved: [], deleted: [], errors: [] };

    if (toDelete.length > 0) {
      const deleteMutation = `
        mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) {
            deletedMetafields { ownerId namespace key }
            userErrors { field message }
          }
        }
      `;

      const deleteRes = await admin.graphql(deleteMutation, {
        variables: { metafields: toDelete },
      });

      const deleteJson = await deleteRes.json();
      console.log("metafieldsDelete response:", JSON.stringify(deleteJson, null, 2));

      const delErrors = deleteJson?.data?.metafieldsDelete?.userErrors || [];

      if (delErrors.length > 0) {
        results.errors.push(...delErrors);
      } else {
        results.deleted.push(...toDelete.map((d) => d.ownerId));
      }
    }

    if (toSave.length > 0) {
      const saveMutation = `
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { id key namespace value }
            userErrors { field message }
          }
        }
      `;

      const saveRes = await admin.graphql(saveMutation, {
        variables: { metafields: toSave },
      });

      const saveJson = await saveRes.json();
      console.log("metafieldsSet response:", JSON.stringify(saveJson, null, 2));

      const saveErrors = saveJson?.data?.metafieldsSet?.userErrors || [];

      if (saveErrors.length > 0) {
        results.errors.push(...saveErrors);
      } else {
        results.saved.push(...toSave.map((s) => s.ownerId));
      }
    }

    const success = results.errors.length === 0;

    return new Response(
      JSON.stringify({
        success,
        ...results,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error saving wholesale data:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
