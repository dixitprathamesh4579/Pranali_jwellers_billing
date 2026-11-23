import React from "react";

export default function BillSummary({
  money,
  netPayable,
  items,
  totals,
  discount,
  setDiscount,
  clearNotice,
  billingType,
  exchangeTotal,
  paidAmount,
  setPaidAmount,
  dueAmount,
  notice,
  noticeType,
  previewPDF,
  downloadPDF,
  onSendWhatsApp,
  isSaving,
  isSendingWhatsApp
}) {
  return (
    <aside className="shbill-summary-column">
      <section className="shbill-summary-card">

        <div className="shbill-summary-heading">
          <span className="shbill-summary-icon" aria-hidden="true">✦</span>
          <div>
            <p>Your invoice</p>
            <h2>Bill summary</h2>
          </div>
        </div>

        <div className="shbill-total-panel">
          <span>Amount to collect</span>
          <strong>{money(netPayable)}</strong>
          <small>
            {items.length} {items.length === 1 ? "item" : "items"} on this bill
          </small>
        </div>

        <div className="shbill-summary-rows">
          <div>
            <span>Subtotal</span>
            <strong>{money(totals.subtotal)}</strong>
          </div>

          <label className="shbill-discount-row">
            <span>Discount</span>
            <span className="shbill-discount-input">
              <span>₹</span>
              <input
                aria-label="Discount in rupees"
                type="text"
                inputMode="decimal"
                value={discount}
                onChange={(event) => {
                  setDiscount(event.target.value.replace(/[^0-9.]/g, ""));
                  clearNotice();
                }}
                placeholder="0.00"
              />
            </span>
          </label>

          <div>
            <span>After discount</span>
            <strong>{money(totals.taxableAmount)}</strong>
          </div>

          {billingType === "GST" && (
            <div>
              <span>GST <small>(3% demo)</small></span>
              <strong>{money(totals.gstAmount)}</strong>
            </div>
          )}
        </div>

        <div className="shbill-grand-total">
          <span>Grand total</span>
          <strong>{money(totals.grandTotal)}</strong>
        </div>

        {exchangeTotal > 0 && (
          <>
            <div className="shbill-summary-row">
              <span>Less: exchange value</span>
              <strong className="shbill-exchange-deduction">
                − {money(exchangeTotal)}
              </strong>
            </div>

            <div className="shbill-grand-total shbill-net-payable">
              <span>Net payable</span>
              <strong>{money(netPayable)}</strong>
            </div>
          </>
        )}

        <label className="shbill-field shbill-paid-field">
          <span>Paid amount (₹)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            max={netPayable}
            value={paidAmount}
            onChange={(event) => {
              setPaidAmount(event.target.value);
              clearNotice();
            }}
            placeholder="Enter amount received"
          />
        </label>

        <div className="shbill-summary-row shbill-due-row">
          <span>Due amount</span>
          <strong>{money(dueAmount)}</strong>
        </div>

        {billingType === "GST" && (
          <p className="shbill-tax-note">
            GST is currently set to a demonstration rate of 3%.
          </p>
        )}

        {notice && (
          <div
            className={`shbill-notice ${noticeType}`}
            role="status"
            aria-live="polite"
          >
            {notice}
          </div>
        )}

        <div className="shbill-summary-actions">

          <button
            className="shbill-secondary-button"
            type="button"
            onClick={previewPDF}
          >
            Preview PDF
          </button>

          <button
            className="shbill-secondary-button shbill-whatsapp-button"
            type="button"
            onClick={onSendWhatsApp}
            disabled={isSaving || isSendingWhatsApp}
          >
            {isSendingWhatsApp
              ? "Sending WhatsApp..."
              : "Send PDF on WhatsApp"}
          </button>

          <button
            className="shbill-primary-button"
            type="button"
            onClick={downloadPDF}
            disabled={isSaving || isSendingWhatsApp}
          >
            {isSaving ? "Saving bill..." : "Save bill & download PDF"}
          </button>

        </div>

        <p className="shbill-help-text">
          Review customer details, item weight and rates before saving.
        </p>

      </section>
    </aside>
  );
}