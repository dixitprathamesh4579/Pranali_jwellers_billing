import React from "react";

export default function BillPageHeading({ billNumber }) {
  return (
    <section className="shbill-hero-heading">
      <div className="shbill-hero-copy">
        <p className="shbill-hero-kicker">
          PRANALI JEWELLERS / WORKSPACE
        </p>

        <h1>Create sales bill</h1>

        <p className="shbill-hero-description">
          Manage your shop operations in one place.
        </p>
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