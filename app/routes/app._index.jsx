import { useState, useEffect, useMemo, useRef } from "react"
import { useAppBridge } from "@shopify/app-bridge-react"

export default function Pricing() {
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const originalVariantsRef = useRef([])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      try {
        const res = await fetch("/api/products")
        if (!res.ok) throw new Error(res.statusText)
        const data = await res.json()

        const flattened = (data.products?.edges || []).flatMap((edge) => {
          const product = edge.node
          return (product.variants?.edges || []).map((variantEdge) => {
            const v = variantEdge.node
            let wholesaleValue = ""
            let wholesaleMinQty = ""

            // Parse wholesale price
            if (v.wholesalePrice?.value) {
              try {
                const parsed = JSON.parse(v.wholesalePrice.value)
                wholesaleValue = parsed.amount
              } catch {
                wholesaleValue = v.wholesalePrice.value
              }
            }

            // Parse minimum quantity
            if (v.wholesaleMinimumQuantity?.value) {
              try {
                wholesaleMinQty = parseInt(v.wholesaleMinimumQuantity.value)
              } catch {
                wholesaleMinQty = v.wholesaleMinimumQuantity.value
              }
            }

            return {
              id: v.id,
              productTitle: product.title,
              variantTitle: v.title,
              price: v.price,
              wholesalePrice: wholesaleValue,
              wholesaleMinimumQuantity: wholesaleMinQty,
              imageUrl: product.featuredMedia?.image?.url || "",
            }
          })
        })

        setVariants(flattened)
        originalVariantsRef.current = JSON.parse(JSON.stringify(flattened))
      } catch (err) {
        console.error("Error fetching products:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  const filteredVariants = useMemo(() => {
    if (!debouncedQuery.trim()) return variants
    const lower = debouncedQuery.toLowerCase()
    return variants.filter((v) =>
      [
        v.productTitle,
        v.variantTitle,
        String(v.price),
        String(v.wholesalePrice ?? ""),
        String(v.wholesaleMinimumQuantity ?? ""),
      ].some((f) => f?.toLowerCase().includes(lower)),
    )
  }, [variants, debouncedQuery])

  function handlePriceChange(variantId, value) {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId ? { ...v, wholesalePrice: value } : v,
      ),
    )
  }

  function handleMinQtyChange(variantId, value) {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId ? { ...v, wholesaleMinimumQuantity: value } : v,
      ),
    )
  }

  function formatMoney(value) {
    if (value === "" || value == null) return ""
    const num = parseFloat(value)
    if (isNaN(num)) return value
    return num.toFixed(2)
  }

  function handleDiscard(e) {
    e.preventDefault()
    setVariants((prev) =>
      prev.map((v) => {
        const orig = originalVariantsRef.current.find((o) => o.id === v.id)
        return orig &&
          (v.wholesalePrice !== orig.wholesalePrice ||
            v.wholesaleMinimumQuantity !== orig.wholesaleMinimumQuantity)
          ? {
              ...v,
              wholesalePrice: orig.wholesalePrice,
              wholesaleMinimumQuantity: orig.wholesaleMinimumQuantity,
            }
          : v
      }),
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    const shopify = useAppBridge()

    const invalidVariants = []
    const changed = variants.filter((v) => {
      const orig = originalVariantsRef.current.find((o) => o.id === v.id)
      const hasChanges =
        orig &&
        (v.wholesalePrice !== orig.wholesalePrice ||
          v.wholesaleMinimumQuantity !== orig.wholesaleMinimumQuantity)

      // Validate minimum quantity before saving
      if (hasChanges && v.wholesaleMinimumQuantity !== "") {
        const qty = parseInt(v.wholesaleMinimumQuantity, 10)
        if (isNaN(qty) || qty < 0) {
          invalidVariants.push(v)
        }
      }

      return hasChanges
    })

    if (invalidVariants.length > 0) {
      shopify.toast.show(
        `${invalidVariants.length} variant${
          invalidVariants.length === 1 ? "" : "s"
        } have invalid minimum quantities. Please enter a number.`,
        { duration: 6000, isError: true },
      )
      return
    }

    if (changed.length === 0) return

    if (changed.length > 25) {
      shopify.toast.show(
        "You can only update up to 25 variants at a time. Please save in smaller batches.",
        { duration: 6000, isError: true },
      )
      return
    }

    try {
      const res = await fetch("/api/wholesale/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: changed.map((v) => ({
            variantId: v.id,
            value: v.wholesalePrice,
            minimumQuantity: v.wholesaleMinimumQuantity,
          })),
        }),
      })

      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      const data = await res.json()

      if (!data.success) {
        console.error("Errors saving metafields:", data.errors)
        shopify.toast.show("Some variants failed to save.", { duration: 5000 })
        return
      }

      originalVariantsRef.current = JSON.parse(JSON.stringify(variants))
      shopify.toast.show(
        `${changed.length} variant${changed.length === 1 ? "" : "s"} updated`,
        { duration: 5000 },
      )
    } catch (err) {
      console.error("Error saving wholesale prices:", err)
      shopify.toast.show("Failed to set wholesale prices.", { duration: 5000 })
    }
  }

  return (
    <s-page heading="Wholesale Pricing">
      {loading ? (
        <s-spinner accessibilityLabel="Loading" size="large-100" />
      ) : (
        <s-stack direction="block" gap="base">
         <s-banner tone="info">
            Wholesale pricing is only available to customers tagged 'Wholesale'.
          </s-banner>
          <s-text-field
            icon="search"
            placeholder="Search anything"
            value={query}
            onInput={(e) => setQuery(e.target.value)}
            label=""
            labelAccessibilityVisibility="hidden"
          />

          <form data-save-bar onSubmit={handleSave} onReset={handleDiscard}>
            <s-section padding="none">
              <s-table>
                <s-table-header-row>
                  <s-table-header />
                  <s-table-header listSlot="primary">Product</s-table-header>
                  <s-table-header>Retail Price</s-table-header>
                  <s-table-header>Wholesale Price</s-table-header>
                  <s-table-header>Minimum Quantity</s-table-header>
                </s-table-header-row>

                <s-table-body>
                  {filteredVariants.length === 0 ? (
                    <s-table-row>
                      <s-table-cell>
                        <s-text>No results found.</s-text>
                      </s-table-cell>
                    </s-table-row>
                  ) : (
                    filteredVariants.map((v) => (
                      <s-table-row key={v.id}>
                        <s-table-cell>
                          <s-box inlineSize="40px" blockSize="40px">
                            <s-image
                              src={v.imageUrl}
                              loading="lazy"
                              aspect-ratio="1/1"
                              objectFit="contain"
                              borderColor="strong"
                              borderStyle="solid"
                              borderWidth="small"
                              borderRadius="base"
                            />
                          </s-box>
                        </s-table-cell>

                        <s-table-cell className="product-column">
                          <s-box maxInlineSize="300px">
                            <s-stack direction="block" gap="small-400">
                              <s-text type="strong">{v.productTitle}</s-text>
                              {v.variantTitle !== "Default Title" && (
                                <s-badge>{v.variantTitle}</s-badge>
                              )}
                            </s-stack>
                          </s-box>
                        </s-table-cell>

                        <s-table-cell>${v.price}</s-table-cell>

                        <s-table-cell>
                          <s-text-field
                            prefix="$"
                            value={v.wholesalePrice ?? "-"}
                            label=""
                            labelAccessibilityVisibility="hidden"
                            onInput={(e) =>
                              handlePriceChange(v.id, e.target.value)
                            }
                            onBlur={(e) => {
                              const formatted = formatMoney(e.target.value)
                              if (formatted !== e.target.value) {
                                handlePriceChange(v.id, formatted)
                              }
                            }}
                          />
                        </s-table-cell>

                        <s-table-cell>
                          <s-text-field
                            type="number"
                            max={999}
                            min={0}
                            value={v.wholesaleMinimumQuantity ?? ""}
                            label=""
                            labelAccessibilityVisibility="hidden"
                            onInput={(e) =>
                              handleMinQtyChange(v.id, e.target.value)
                            }
                          />
                        </s-table-cell>
                      </s-table-row>
                    ))
                  )}
                </s-table-body>
              </s-table>
            </s-section>
          </form>
        </s-stack>
      )}
    </s-page>
  )
}
