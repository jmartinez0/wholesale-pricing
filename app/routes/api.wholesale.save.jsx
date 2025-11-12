import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    const { updates } = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return new Response(JSON.stringify({ error: "No updates provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Split updates into toSave (non-empty) and toDelete (empty)
    const toSave = [];
    const toDelete = [];

    for (const { variantId, value } of updates) {
      const trimmed = String(value ?? "").trim();
      if (trimmed === "" || trimmed.toLowerCase() === "null") {
        toDelete.push({ ownerId: variantId });
      } else {
        const num = parseFloat(trimmed);
        if (isNaN(num)) continue; // skip invalid numbers
        toSave.push({
          ownerId: variantId,
          namespace: "wholesale",
          key: "price",
          type: "money",
          value: JSON.stringify({
            amount: num,
            currency_code: "USD",
          }),
        });
      }
    }

    const results = { saved: [], deleted: [], errors: [] };

    // Handle deletions (blank values)
    if (toDelete.length > 0) {
      const deleteMutation = `
        mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) {
            deletedMetafields {
              ownerId
              namespace
              key
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const deleteRes = await admin.graphql(deleteMutation, {
        variables: {
          metafields: toDelete.map((d) => ({
            ownerId: d.ownerId,
            namespace: "wholesale",
            key: "price",
          })),
        },
      });

      const deleteJson = await deleteRes.json();
      const delErrors = deleteJson?.data?.metafieldsDelete?.userErrors || [];

      if (delErrors.length > 0) {
        results.errors.push(...delErrors);
      } else {
        results.deleted.push(...toDelete.map((d) => d.ownerId));
      }
    }

    // Handle saves (non-empty values)
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
      const saveErrors = saveJson?.data?.metafieldsSet?.userErrors || [];

      if (saveErrors.length > 0) {
        results.errors.push(...saveErrors);
      } else {
        results.saved.push(...toSave.map((s) => s.ownerId));
      }
    }

    const success = results.errors.length === 0;

    return new Response(JSON.stringify({ success, ...results }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error saving wholesale prices:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
