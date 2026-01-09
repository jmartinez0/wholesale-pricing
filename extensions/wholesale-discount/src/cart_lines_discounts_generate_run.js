export function cartLinesDiscountsGenerateRun(input) {
  const isWholesale = input.cart?.buyerIdentity?.customer?.hasAnyTag || false;
  if (!isWholesale) return { operations: [] };

  const candidates = [];

  for (const line of input.cart.lines) {
    const priceMeta = line.merchandise?.wholesalePrice;
    const minQtyMeta = line.merchandise?.wholesaleMinQty;
    if (!priceMeta?.value) continue;

    const wholesale = parseFloat(priceMeta.value);
    if (isNaN(wholesale)) continue;

    const minQty = parseInt(minQtyMeta?.value ?? "1", 10);
    const qty = line.quantity ?? 1;
    if (qty < minQty) continue;

    const subtotal = parseFloat(line.cost.subtotalAmount.amount);
    const retail = subtotal / qty;

    if (wholesale >= retail) continue;

    const discountPerItem = retail - wholesale;

    candidates.push({
      message: "Wholesale",
      targets: [{ cartLine: { id: line.id } }],
      value: {
        fixedAmount: {
          amount: discountPerItem.toFixed(2),
          appliesToEachItem: true,
        },
      },
    });
  }

  if (candidates.length === 0) return { operations: [] };

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}
