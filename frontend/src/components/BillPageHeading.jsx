import React from "react";

export default function BillPageHeading({ billNumber }) {
  return (
    <section className="shbill-hero-heading">
      <div className="shbill-hero-copy">
      

        <h1>Create sales bill</h1>

      
      </div>

      <div
        className="shbill-hero-billno"
        aria-label={`Bill number ${billNumber || "Pending"}`}
      >
        <span>Bill number</span>
        <strong>{billNumber || "Pending"}</strong>
        <small>Generated automatically</small>
      </div>
    </section>
  );
}