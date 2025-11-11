export default function PrivacyPolicy() {
  return (
    <main style={{ maxWidth: "700px", margin: "2rem auto", fontFamily: "sans-serif", lineHeight: 1.6 }}>
      <h1>Privacy Policy</h1>
      <p>This app does not collect, store, or share any personal customer data outside of Shopify.</p>
      <p>It only reads customer tags and product metafields within Shopify to apply wholesale pricing logic.</p>
      <p>No data is transmitted or stored externally.</p>
      <p>For questions or data deletion requests, contact:</p>
      <p><strong>Juan Martinez</strong><br />jmartinez.16c@gmail.com</p>
      <Outlet />
    </main>
  );
}
