export function cartLinesDiscountsGenerateRun(input) {
  const isWholesale = input.cart?.buyerIdentity?.customer?.hasAnyTag || false
  if (!isWholesale) {
    return { operations: [] }
  }

  const candidates = []

  for (const line of input.cart.lines) {
    const meta = line.merchandise?.metafield
    if (!meta?.value) continue

    let wholesale
    try {
      const parsed = JSON.parse(meta.value)
      wholesale = parseFloat(parsed.amount)
    } catch {
      wholesale = parseFloat(meta.value)
    }
    if (isNaN(wholesale)) continue

    const subtotal = parseFloat(line.cost.subtotalAmount.amount)
    const qty = line.quantity ?? 1
    const retail = subtotal / qty
    if (wholesale >= retail) continue

    const discountPerItem = retail - wholesale

    candidates.push({
      message: "WHOLESALE",
      targets: [{ cartLine: { id: line.id } }],
      value: {
        fixedAmount: {
          amount: discountPerItem.toFixed(2),
          appliesToEachItem: true,
        },
      },
    })
  }

  if (candidates.length === 0) return { operations: [] }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: "ALL",
        },
      },
    ],
  }
}
