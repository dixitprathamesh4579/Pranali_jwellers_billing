import { useMemo, useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "./NewSHBill.css";

const makeItem = () => ({
  id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  name: "",
  metal: "Gold",
  weight: "",
  purity: "22K",
  rate: "",
  makingCharges: "",
});

const makeExchangeItem = () => ({
  id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  metal: "Gold",
  description: "",
  purity: "22K",
  grossWeight: "",
  deductionWeight: "0",
  rate: "",
  manualValue: "",
});

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const SHOP = {
  name: "PRANALI JEWELLERS",
  tagline: "GOLD | SILVER | ONE GRAM | CUSTOM JEWELLERY",
  address:
    "Grampanchayat Gala No.04, Main Road - mandai, Dighanchi, Maharashtra - 415315",
  phone: "+91 9421124579",
  by: "Prakash Dixit(sir)",
  email: "pranalijewellers@gmail.com",
  footer: "Your Trust  •  Our Heritage  •  Timeless Jewellery",
};

const amountInWords = (amount) => {
  const n = Math.round(Number(amount) || 0);

  if (!n) return "Zero Rupees Only";

  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const t = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const under1000 = (x) => {
    let out = "";

    if (x >= 100) {
      out += a[Math.floor(x / 100)] + " Hundred ";
      x %= 100;
    }

    if (x >= 20) {
      out += t[Math.floor(x / 10)] + " ";
      x %= 10;
    }

    if (x > 0) out += a[x] + " ";

    return out.trim();
  };

  let rest = n;
  let out = "";

  [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"], [1, ""]].forEach(
    ([v, label]) => {
      const part = Math.floor(rest / v);

      if (part) {
        out += under1000(part) + (label ? " " + label : "") + " ";
        rest %= v;
      }
    }
  );

  return out.trim() + " Rupees Only";
};

const pdfMoney = (v) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v) || 0);

const pdfDate = (v) =>
  v
    ? new Date(`${v}T00:00:00`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "";

const getNextBillNumber = () => {
  const storageKey = "pranali_jewellers_next_sh_bill_number";
  let nextNumber = 1;

  try {
    nextNumber = Number(window.localStorage.getItem(storageKey)) || 1;

    window.localStorage.setItem(
      storageKey,
      String(nextNumber + 1)
    );
  } catch (error) {
    nextNumber = Date.now() % 100000;
  }

  const groupIndex = Math.floor((nextNumber - 1) / 100);
  const sequence = ((nextNumber - 1) % 100) + 1;
  const groupLetter = String.fromCharCode(65 + (groupIndex % 26));

  return `${groupLetter}-${sequence}`;
};

export default function NewSHBill({ onNavigate }) {
  // ---------------- STATES ----------------

  const [billingType, setBillingType] = useState("GST");

  const [billDate, setBillDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );

  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
  });

  const [items, setItems] = useState([makeItem()]);
  const [exchangeItems, setExchangeItems] = useState([]);

  const [discount, setDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");

  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("error");

  const [billNumber] = useState(getNextBillNumber);

  const [previewUrl, setPreviewUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const [savedBillNumber, setSavedBillNumber] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const savingRef = useRef(false);
  const savedBillDataRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // ---------------- TOTAL CALCULATION ----------------

  const totals = useMemo(() => {
    const calculated = items.map((item) => {
      const weight = Math.max(0, Number(item.weight) || 0);
      const rate = Math.max(0, Number(item.rate) || 0);

      const makingCharges = Math.max(
        0,
        Number(item.makingCharges) || 0
      );

      const metalValue = weight * rate;

      return {
        ...item,
        weight,
        rate,
        makingCharges,
        metalValue,
        itemTotal: metalValue + makingCharges,
      };
    });

    const subtotal = calculated.reduce(
      (sum, item) => sum + item.itemTotal,
      0
    );

    const discountAmount = Math.min(
      subtotal,
      Math.max(0, Number(discount) || 0)
    );

    const taxableAmount = Math.max(
      0,
      subtotal - discountAmount
    );

    // Demonstration GST rate: 3%
    const gstAmount =
      billingType === "GST" ? taxableAmount * 0.03 : 0;

    return {
      items: calculated,
      subtotal,
      discountAmount,
      taxableAmount,
      gstAmount,
      grandTotal: taxableAmount + gstAmount,
    };
  }, [items, discount, billingType]);

  // ---------------- EXCHANGE CALCULATION ----------------

  const calculatedExchangeItems = exchangeItems.map((item) => {
    const grossWeight = Number(item.grossWeight) || 0;
    const deductionWeight = Number(item.deductionWeight) || 0;

    const netWeight = Math.max(
      0,
      grossWeight - deductionWeight
    );

    const rate = Number(item.rate) || 0;

    const exchangeValue =
      item.metal === "Other"
        ? Math.max(0, Number(item.manualValue) || 0)
        : netWeight * rate;

    return {
      ...item,
      grossWeight,
      deductionWeight,
      netWeight,
      rate,
      exchangeValue,
    };
  });

  const exchangeTotal = calculatedExchangeItems.reduce(
    (sum, item) => sum + item.exchangeValue,
    0
  );

  const netPayable = Math.max(
    0,
    totals.grandTotal - exchangeTotal
  );

  const dueAmount = Math.max(
    0,
    netPayable - (Number(paidAmount) || 0)
  );

  // ---------------- VALIDATION ----------------

  const validateForPdf = () => {
    if (!customer.name.trim()) {
      return "Please enter customer name.";
    }

    if (!/^[0-9]{10}$/.test(customer.phone)) {
      return "Please enter a valid 10-digit mobile number.";
    }

    if (!billDate) {
      return "Please select bill date.";
    }

    if (!items.length) {
      return "Please add at least one jewellery item.";
    }

    for (const item of totals.items) {
      if (!item.name.trim()) {
        return "Please enter all jewellery item names.";
      }

      if (item.weight <= 0 || item.rate <= 0) {
        return "Weight and rate must be greater than zero.";
      }
    }

    if (exchangeTotal > totals.grandTotal) {
      return "Exchange value cannot be greater than the bill grand total.";
    }

    for (const item of calculatedExchangeItems) {
      if (!item.description.trim()) {
        return "Please enter a description for every exchange item.";
      }

      if (item.metal === "Other") {
        if (item.exchangeValue <= 0) {
          return "Please enter a valid exchange value for Other items.";
        }
      } else {
        if (
          item.grossWeight <= 0 ||
          item.rate <= 0 ||
          item.deductionWeight < 0 ||
          item.deductionWeight > item.grossWeight
        ) {
          return "Check exchange gross weight, deduction weight and rate.";
        }
      }
    }

    const paid = Number(paidAmount);

    if (
      !Number.isFinite(paid) ||
      paid < 0 ||
      paid > netPayable
    ) {
      return "Paid amount must be between ₹0 and the net payable amount.";
    }

    if (totals.grandTotal <= 0) {
      return "Bill total must be greater than zero.";
    }

    return null;
  };

  // ---------------- BUILD DATABASE OBJECT ----------------

  const buildBillData = () => ({
    bill_number: billNumber,

    billing_type:
      billingType === "GST" ? "GST" : "WITHOUT_GST",

    bill_date: billDate,

    customer_name: customer.name.trim(),
    customer_phone: customer.phone.trim(),
    customer_address: customer.address.trim(),

    items: totals.items,

    subtotal: Number(totals.subtotal.toFixed(2)),

    discount_amount: Number(
      totals.discountAmount.toFixed(2)
    ),

    gst_amount: Number(totals.gstAmount.toFixed(2)),

    grand_total: Number(totals.grandTotal.toFixed(2)),

    exchange_items: calculatedExchangeItems.map((item) => ({
      metal: item.metal,
      description: item.description,
      purity: item.purity,
      gross_weight: item.grossWeight,
      deduction_weight: item.deductionWeight,
      net_weight: item.netWeight,
      rate: item.rate,
      exchange_value: Number(item.exchangeValue.toFixed(2)),
    })),

    exchange_total: Number(exchangeTotal.toFixed(2)),

    net_payable: Number(netPayable.toFixed(2)),

    paid_amount: Number(paidAmount) || 0,

    due_amount: Number(dueAmount.toFixed(2)),
  });

  // ---------------- SAVE BILL TO MYSQL ----------------

  const saveBillToDatabase = async () => {
    const validationError = validateForPdf();

    if (validationError) {
      setNotice(validationError);
      setNoticeType("error");
      return false;
    }

    const billData = buildBillData();
    const billDataSnapshot = JSON.stringify(billData);

    // Prevent duplicate insertion
    if (savedBillNumber === billNumber) {
      if (savedBillDataRef.current !== billDataSnapshot) {
        setNotice(
          "This bill is already saved. Do not change its details; create a new bill instead."
        );

        setNoticeType("error");
        return false;
      }

      return true;
    }

    if (savingRef.current) {
      return false;
    }

    savingRef.current = true;
    setIsSaving(true);

    setNotice("Saving bill to database...");
    setNoticeType("success");

    try {
      const apiBaseUrl = (
        import.meta.env.VITE_API_BASE_URL ||
        "https://pranali-jwellers-billing.onrender.com"
      ).replace(/\/$/, "");

      const response = await fetch(
        `${apiBaseUrl}/api/sh-bills`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: billDataSnapshot,
        }
      );

      let result = {};

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          result.message ||
          `Bill saving failed (HTTP ${response.status}).`
        );
      }

      savedBillDataRef.current = billDataSnapshot;

      setSavedBillNumber(billNumber);

      setNotice(
        `Bill ${billNumber} saved successfully!`
      );

      setNoticeType("success");

      return true;
    } catch (error) {
      console.error("Save Bill Error:", error);

      setNotice(
        error.message ||
        "Unable to save bill. Check that the backend is running."
      );

      setNoticeType("error");

      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // ---------------- SAVE BILL BUTTON ----------------

  const saveBill = async () => {
    await saveBillToDatabase();
  };
  // ---------------- NOTICE ----------------

  const clearNotice = () => {
    setNotice("");
  };

  // ---------------- CUSTOMER UPDATE ----------------

  const updateCustomer = (field, value) => {
    setCustomer((old) => ({
      ...old,
      [field]: value,
    }));

    clearNotice();
  };

  // ---------------- ITEM UPDATE ----------------

  const updateItem = (id, field, value) => {
    setItems((old) =>
      old.map((item) =>
        item.id === id
          ? { ...item, [field]: value }
          : item
      )
    );

    clearNotice();
  };

  // ---------------- ADD ITEM ----------------

  const addItem = () => {
    setItems((old) => [...old, makeItem()]);
    clearNotice();
  };

  // ---------------- REMOVE ITEM ----------------

  const removeItem = (id) => {
    setItems((old) =>
      old.length > 1
        ? old.filter((item) => item.id !== id)
        : old
    );

    clearNotice();
  };

  // ---------------- EXCHANGE ITEM FUNCTIONS ----------------

  const addExchangeItem = () => {
    setExchangeItems((old) => [
      ...old,
      makeExchangeItem()
    ]);

    clearNotice();
  };

  const updateExchangeItem = (id, field, value) => {
    setExchangeItems((old) =>
      old.map((item) =>
        item.id === id
          ? { ...item, [field]: value }
          : item
      )
    );

    clearNotice();
  };

  const removeExchangeItem = (id) => {
    setExchangeItems((old) =>
      old.filter((item) => item.id !== id)
    );

    clearNotice();
  };

  // ---------------- CREATE PDF ----------------

  const createInvoicePDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const W = 210;
    const H = 297;
    const M = 10;
    const CW = W - 2 * M;

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, "F");

    doc.setDrawColor(190, 145, 55);
    doc.setLineWidth(0.65);
    doc.rect(5, 5, W - 10, H - 10);

    doc.setLineWidth(0.2);
    doc.rect(7, 7, W - 14, H - 14);

    // Shop header
    doc.setFillColor(250, 245, 234);
    doc.rect(8, 8, W - 16, 37, "F");

    doc.setTextColor(125, 83, 20);
    doc.setFont("times", "bold");
    doc.setFontSize(21);

    doc.text(SHOP.name, W / 2, 17, {
      align: "center",
    });

    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 52, 40);

    doc.text(SHOP.tagline, W / 2, 22, {
      align: "center",
    });

    doc.text(SHOP.address, W / 2, 27, {
      align: "center",
      maxWidth: CW - 8,
    });

    doc.text(
      `Phone: ${SHOP.phone}  |  Email: ${SHOP.email}`,
      W / 2,
      32,
      { align: "center" }
    );

    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(125, 83, 20);

    doc.text("SALES INVOICE", W / 2, 40, {
      align: "center",
    });

    // Customer and invoice details
    const leftX = M;
    const gap = 4;
    const leftW = 112;
    const rightX = leftX + leftW + gap;
    const rightW = CW - leftW - gap;

    const panelY = 49;
    const panelH = 31;

    doc.setDrawColor(205, 183, 139);
    doc.setLineWidth(0.25);

    doc.roundedRect(
      leftX,
      panelY,
      leftW,
      panelH,
      1.5,
      1.5
    );

    doc.roundedRect(
      rightX,
      panelY,
      rightW,
      panelH,
      1.5,
      1.5
    );

    doc.setFillColor(244, 234, 212);

    doc.rect(leftX, panelY, leftW, 6, "F");
    doc.rect(rightX, panelY, rightW, 6, "F");

    doc.setTextColor(60, 45, 23);
    doc.setFont("times", "bold");
    doc.setFontSize(7.5);

    doc.text(
      "CUSTOMER DETAILS",
      leftX + 3,
      panelY + 4.2
    );

    doc.text(
      "INVOICE DETAILS",
      rightX + 3,
      panelY + 4.2
    );

    doc.setFont("times", "normal");
    doc.setFontSize(7.3);

    const address = customer.address?.trim()
      ? customer.address.trim()
      : "-";

    doc.text(
      doc
        .splitTextToSize(
          `Name: ${customer.name}`,
          leftW - 6
        )
        .slice(0, 1),
      leftX + 3,
      panelY + 12
    );

    doc.text(
      `Mobile: ${customer.phone}`,
      leftX + 3,
      panelY + 18
    );

    doc.text(
      doc
        .splitTextToSize(
          `Address: ${address}`,
          leftW - 6
        )
        .slice(0, 1),
      leftX + 3,
      panelY + 24
    );

    doc.text(
      doc.splitTextToSize(
        `Bill No: ${billNumber}`,
        rightW - 6
      ),
      rightX + 3,
      panelY + 12
    );

    doc.text(
      doc.splitTextToSize(
        `Date: ${pdfDate(billDate)}`,
        rightW - 6
      ),
      rightX + 3,
      panelY + 18
    );
    // ---------------- NEW GOLD / SILVER / OTHER DETAILS HEADING ----------------

    doc.setFont("times", "bold");
    doc.setFontSize(9);
    doc.setTextColor(125, 83, 20);

    doc.text(
      "NEW GOLD / SILVER / OTHER DETAILS",
      M,
      84
    );

    // ---------------- JEWELLERY TABLE ----------------

    const count = totals.items.length;

    const tableFont =
      count > 10 ? 5.2 : count > 6 ? 6 : 6.6;


    autoTable(doc, {
      startY: 88,

      margin: {
        left: M,
        right: M,
        bottom: 62,
      },

      theme: "grid",
      pageBreak: "avoid",

      head: [
        [
          "Sr.",
          "Jewellery Description",
          "Metal / Purity",
          "Wt. (g)",
          "Rate per g ",
          "Metal ",
          "Making ",
          "Total ",
        ],
      ],

      body: totals.items.map((it, i) => [
        String(i + 1),
        it.name,
        `${it.metal} / ${it.purity}`,
        Number(it.weight).toFixed(3),
        pdfMoney(it.rate),
        pdfMoney(it.metalValue),
        pdfMoney(it.makingCharges),
        pdfMoney(it.itemTotal),
      ]),

      styles: {
        font: "times",
        fontSize: tableFont,
        cellPadding: count > 8 ? 1.1 : 1.7,
        textColor: [40, 40, 40],
        lineColor: [220, 205, 177],
        lineWidth: 0.2,
        overflow: "linebreak",
        valign: "middle",
      },

      headStyles: {
        fillColor: [125, 83, 20],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },

      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 39 },
        2: { cellWidth: 26 },
        3: { cellWidth: 16, halign: "right" },
        4: { cellWidth: 23, halign: "right" },
        5: { cellWidth: 25, halign: "right" },
        6: { cellWidth: 23, halign: "right" },
        7: { cellWidth: 30, halign: "right" },
      },

      tableWidth: "auto",
    });

    // ---------------- EXCHANGE DETAILS IN PDF ----------------

    if (calculatedExchangeItems.length > 0) {
      const exchangeStartY =
        (doc.lastAutoTable?.finalY || 100) + 7;

      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setTextColor(125, 83, 20);

      doc.text(" OLD GOLD / SILVER / OTHER EXCHANGE DETAILS", M, exchangeStartY);

      autoTable(doc, {
        startY: exchangeStartY + 3,

        margin: {
          left: M,
          right: M,
          bottom: 62,
        },

        theme: "grid",

        head: [[
          "Sr.",
          "Type",
          "Description",
          "Purity",
          "Gross Wt.",
          "Deduction",
          "Net Wt.",
          "Rate/g",
          "Exchange Value",
        ]],

        body: calculatedExchangeItems.map((item, index) => [
          index + 1,
          item.metal,
          item.description || "-",
          item.metal === "Other" ? "-" : item.purity,
          item.metal === "Other"
            ? "-"
            : `${item.grossWeight.toFixed(3)} g`,
          item.metal === "Other"
            ? "-"
            : `${item.deductionWeight.toFixed(3)} g`,
          item.metal === "Other"
            ? "-"
            : `${item.netWeight.toFixed(3)} g`,
          item.metal === "Other"
            ? "-"
            : pdfMoney(item.rate),
          pdfMoney(item.exchangeValue),
        ]),

        styles: {
          font: "times",
          fontSize: 6.5,
          cellPadding: 1.8,
          textColor: [40, 40, 40],
          lineColor: [220, 205, 177],
          lineWidth: 0.2,
          overflow: "linebreak",
          valign: "middle",
        },

        headStyles: {
          fillColor: [125, 83, 20],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },

        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 15 },
          2: { cellWidth: 35 },
          3: { cellWidth: 15 },
          4: { cellWidth: 20 },
          5: { cellWidth: 20 },
          6: { cellWidth: 20 },
          7: { cellWidth: 20 },
          8: { cellWidth: 27, halign: "right" },
        },

        tableWidth: "auto",
      });

      // Total exchange value
      const exchangeEndY = doc.lastAutoTable.finalY + 4;

      doc.setFont("times", "bold");
      doc.setFontSize(8);
      doc.setTextColor(125, 83, 20);

      doc.text(
        `TOTAL EXCHANGE VALUE: Rs. ${pdfMoney(exchangeTotal)}`,
        W - M,
        exchangeEndY,
        { align: "right" }
      );
    }


    // Totals
    const totalsY = (doc.lastAutoTable?.finalY || 100) + 8;
    const rowH = 6;

    const paid = Number(paidAmount) || 0;

    const rows = [
      ["Subtotal", totals.subtotal],
      ["Discount", totals.discountAmount],

      ...(billingType === "GST"
        ? [["GST (3% demo)", totals.gstAmount]]
        : []),

      ["GRAND TOTAL", totals.grandTotal],

      ...(exchangeTotal > 0
        ? [["LESS: EXCHANGE VALUE", exchangeTotal]]
        : []),

      ...(exchangeTotal > 0
        ? [["NET PAYABLE", netPayable]]
        : []),

      ["PAID AMOUNT", paid],
      ["DUE AMOUNT", dueAmount],
    ];

    rows.forEach(([label, value], i) => {
      const rowY = totalsY + i * rowH;

      if (
        label === "GRAND TOTAL" ||
        label === "NET PAYABLE"
      ) {
        doc.setFillColor(125, 83, 20);

        doc.roundedRect(
          M,
          rowY,
          CW,
          rowH,
          1,
          1,
          "F"
        );

        doc.setTextColor(255, 255, 255);
        doc.setFont("times", "bold");
      } else {
        doc.setTextColor(45, 45, 45);
        doc.setFont("times", "normal");
        doc.setDrawColor(230, 218, 196);

        doc.line(
          M,
          rowY + rowH,
          W - M,
          rowY + rowH
        );
      }

      doc.setFontSize(
        label === "GRAND TOTAL" || label === "NET PAYABLE"
          ? 8.5
          : 7.5
      );

      doc.text(label, M + 3, rowY + 4);

      doc.text(
        `Rs. ${pdfMoney(value)}`,
        W - M - 5,
        rowY + 4,
        {
          align: "right",
          maxWidth: 78,
        }
      );
    });



    const amountWordsY = totalsY + rows.length * rowH + 7;

    doc.setDrawColor(205, 183, 139);
    doc.setFillColor(250, 245, 234);

    doc.roundedRect(
      M,
      amountWordsY,
      CW,
      18,
      1.5,
      1.5,
      "FD"
    );

    doc.setFont("times", "bold");
    doc.setFontSize(8);
    doc.setTextColor(125, 83, 20);

    doc.text(
      "TOTAL AMOUNT IN WORDS",
      M + 3,
      amountWordsY + 5
    );

    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);

    doc.text(
      amountInWords(netPayable),
      M + 3,
      amountWordsY + 12,
      {
        maxWidth: CW - 6,
      }
    );
    const footerY = Math.max(264, amountWordsY + 27);

    doc.setDrawColor(190, 145, 55);

    doc.line(
      M,
      footerY - 4,
      W - M,
      footerY - 4
    );

    doc.setFont("times", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(75, 55, 25);

    doc.text(
      "TERMS & CONDITIONS",
      M,
      footerY + 1
    );

    doc.setFont("times", "normal");
    doc.setFontSize(6.3);
    doc.setTextColor(55, 55, 55);

    const terms = [
      "1. Goods once sold will not be taken back or exchanged.",
      "2. Purity as per applicable hallmark details.",
      "3. Thank you for shopping with us.",
    ];

    doc.text(
      doc
        .splitTextToSize(terms.join("\n"), 112)
        .slice(0, 6),
      M,
      footerY + 6,
      {
        lineHeightFactor: 1.3,
      }
    );

    doc.setDrawColor(90, 90, 90);
    doc.line(139, footerY + 8, 195, footerY + 8);

    doc.setFontSize(7);

    doc.text(
      "Authorised Signatory",
      167,
      footerY + 12,
      { align: "center" }
    );

    doc.setFont("times", "bold");

    doc.text(
      "PRANALI JEWELLERS",
      167,
      footerY + 17,
      { align: "center" }
    );

    doc.setFont("times", "bold");

    doc.text(
      "Customer Signature",
      105,
      footerY + 12,
      { align: "center" }
    );

    doc.setFillColor(125, 83, 20);
    doc.rect(8, H - 13, W - 16, 5, "F");

    doc.setFont("times", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    doc.text(
      SHOP.footer,
      W / 2,
      H - 9.5,
      { align: "center" }
    );

    while (doc.getNumberOfPages() > 1) {
      doc.deletePage(doc.getNumberOfPages());
    }

    return doc;
  };

  // ---------------- PREVIEW PDF ----------------

  const previewPDF = () => {
    const error = validateForPdf();

    if (error) {
      setNotice(error);
      setNoticeType("error");
      return;
    }

    const url = URL.createObjectURL(
      createInvoicePDF().output("blob")
    );

    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });

    setPreviewOpen(true);

    setNotice("PDF preview ready.");
    setNoticeType("success");
  };

  // ---------------- DOWNLOAD PDF ----------------

  const downloadPDF = async () => {
    const isSaved = await saveBillToDatabase();

    if (!isSaved) {
      return;
    }

    createInvoicePDF().save(
      `Pranali-Jewellers-${billNumber}.pdf`
    );

    setNotice(
      `Bill ${billNumber} saved successfully! PDF downloaded.`
    );

    setNoticeType("success");
  };

  // ---------------- UI ----------------

  return (
    <main className="shbill-page">
      <form
        onSubmit={(event) => event.preventDefault()}
        className="shbill-layout"
      >
        <div className="shbill-main-column">
          <section className="shbill-card">
            <div className="shbill-section-heading">
              <span className="shbill-section-icon">01</span>
              <div>
                <h2>Bill information</h2>
                <p>Choose the invoice type and date.</p>
              </div>
            </div>

            <div className="shbill-current-bill-number">
              <span>Bill number</span>
              <strong>{billNumber}</strong>
              <small>Generated automatically</small>
            </div>

            <div className="shbill-type-label">
              How would you like to create this bill?
            </div>

            <div className="shbill-type-options">
              <button
                type="button"
                className={`shbill-type-option ${billingType === "GST" ? "selected" : ""
                  }`}
                onClick={() => {
                  setBillingType("GST");
                  clearNotice();
                }}
                aria-pressed={billingType === "GST"}
              >
                <span className="shbill-type-symbol">%</span>
                <span className="shbill-type-copy">
                  <strong>With GST</strong>
                  <small>GST is included in calculation</small>
                </span>
                <span className="shbill-radio">
                  {billingType === "GST" ? "✓" : ""}
                </span>
              </button>

              <button
                type="button"
                className={`shbill-type-option ${billingType === "NON_GST" ? "selected" : ""
                  }`}
                onClick={() => {
                  setBillingType("NON_GST");
                  clearNotice();
                }}
                aria-pressed={billingType === "NON_GST"}
              >
                <span className="shbill-type-symbol">₹</span>
                <span className="shbill-type-copy">
                  <strong>Without GST</strong>
                  <small>No GST added to the total</small>
                </span>
                <span className="shbill-radio">
                  {billingType === "NON_GST" ? "✓" : ""}
                </span>
              </button>
            </div>

            <label className="shbill-field shbill-date-field">
              <span>
                Bill date <b>*</b>
              </span>

              <input
                type="date"
                value={billDate}
                onChange={(e) => {
                  setBillDate(e.target.value);
                  clearNotice();
                }}
                required
              />
            </label>
          </section>

          <section className="shbill-card">
            <div className="shbill-section-heading">
              <span className="shbill-section-icon">02</span>
              <div>
                <h2>Customer details</h2>
                <p>Who is this bill for?</p>
              </div>
            </div>

            <div className="shbill-fields-grid">
              <label className="shbill-field">
                <span>
                  Customer name <b>*</b>
                </span>

                <input
                  value={customer.name}
                  onChange={(e) =>
                    updateCustomer("name", e.target.value)
                  }
                  placeholder="e.g. Priya Patil"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="shbill-field">
                <span>
                  Mobile number <b>*</b>
                </span>

                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={customer.phone}
                  onChange={(e) =>
                    updateCustomer(
                      "phone",
                      e.target.value.replace(/\D/g, "").slice(0, 10)
                    )
                  }
                  placeholder="Enter 10-digit number"
                  autoComplete="tel"
                  required
                />

                <small>Enter numbers only.</small>
              </label>

              <label className="shbill-field shbill-full">
                <span>
                  Address <em>Optional</em>
                </span>

                <textarea
                  rows={2}
                  value={customer.address}
                  onChange={(e) =>
                    updateCustomer("address", e.target.value)
                  }
                  placeholder="Area, city, PIN code"
                />
              </label>
            </div>
          </section>

          <section className="shbill-card">
            <div className="shbill-section-heading shbill-jewellery-heading">
              <span className="shbill-section-icon">03</span>

              <div>
                <h2>Jewellery items</h2>
                <p>
                  Choose the karat and enter the weight, rate and making
                  charges.
                </p>
              </div>

              <button
                className="shbill-add-button"
                type="button"
                onClick={addItem}
              >
                ＋ Add item
              </button>
            </div>

            {items.map((item, index) => {
              return (
                <article className="shbill-item-card" key={item.id}>
                  <div className="shbill-item-title">
                    <div className="shbill-item-number">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div>
                      <h3>
                        {item.name.trim() ||
                          `Jewellery item ${index + 1}`}
                      </h3>

                      <p>
                        Enter purity, weight and pricing details below
                      </p>
                    </div>

                    <button
                      type="button"
                      className="shbill-remove-button"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="shbill-fields-grid shbill-item-fields">
                    <label className="shbill-field shbill-full">
                      <span>
                        Item name <b>*</b>
                      </span>

                      <input
                        value={item.name}
                        onChange={(e) =>
                          updateItem(item.id, "name", e.target.value)
                        }
                        placeholder="e.g. Gold ring, necklace, bangles"
                        required
                      />
                    </label>

                    <label className="shbill-field">
                      <span>Metal type</span>

                      <select
                        value={item.metal}
                        onChange={(e) =>
                          updateItem(item.id, "metal", e.target.value)
                        }
                      >
                        <option>Gold</option>
                        <option>Silver</option>
                        <option>Other</option>
                      </select>
                    </label>
                    {(item.metal === "Silver" || item.metal === "Other") && (
                      <label className="shbill-field">
                        <span>
                          Purity (%)<b>*</b>
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.itemPurity}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "purity",
                              e.target.value.replace(/[^0-9.]/g, "")
                            )
                          }
                          placeholder="Enter purity (e.g. 91.6)"
                        />
                      </label>
                    )}
                    {item.metal === "Gold" &&
                      (
                        <label className="shbill-field">
                          <span>
                            Purity / Karat <b>*</b>
                          </span>

                          <select
                            value={item.purity}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "purity",
                                e.target.value
                              )
                            }
                          >
                            <option value="24K">24K </option>
                            <option value="22K">22K </option>
                            <option value="20K">20K </option>
                            <option value="18K">18K </option>
                            <option value="14K">14K </option>
                            <option value="9K">9K </option>
                          </select>
                        </label>
                      )}

                    <label className="shbill-field">
                      <span>
                        Weight <b>*</b>
                      </span>

                      <div className="shbill-input-unit">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.weight}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "weight",
                              e.target.value.replace(/[^0-9.]/g, "")
                            )
                          }
                          placeholder="Enter weight"
                          required
                        />

                        <span>g</span>
                      </div>
                    </label>

                    <label className="shbill-field">
                      <span>
                        Rate per gram <b>*</b>
                      </span>

                      <div className="shbill-input-unit">
                        <span>₹</span>

                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.rate}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "rate",
                              e.target.value.replace(/[^0-9.]/g, "")
                            )
                          }
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </label>

                    <label className="shbill-field">
                      <span>Making charges</span>

                      <div className="shbill-input-unit">
                        <span>₹</span>

                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.makingCharges}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "makingCharges",
                              e.target.value.replace(/[^0-9.]/g, "")
                            )
                          }
                          placeholder="0.00"
                        />
                      </div>
                    </label>
                  </div>
                </article>
              );
            })}

            <button
              className="shbill-add-another"
              type="button"
              onClick={addItem}
            >
              <span>＋</span>

              <span>
                <strong>Add another jewellery item</strong>
                <small>
                  Use this if the customer is buying more than one item.
                </small>
              </span>
            </button>
          </section>

          {/* GOLD / SILVER / OTHER EXCHANGE MODULE */}

          <section className="shbill-card">
            <div className="shbill-section-heading">
              <span className="shbill-section-icon">04</span>

              <div>
                <h2>Gold / Silver / Other Exchange</h2>
                <p>
                  Add old jewellery or other items received from the
                  customer.
                </p>
              </div>

              <button
                className="shbill-add-button"
                type="button"
                onClick={addExchangeItem}
              >
                ＋ Add exchange
              </button>
            </div>

            {calculatedExchangeItems.length === 0 ? (
              <div className="shbill-exchange-empty">
                No exchange items added.
                <br />
                <small>
                  Add an item if the customer is exchanging old jewellery.
                </small>
              </div>
            ) : (
              calculatedExchangeItems.map((item, index) => (
                <article className="shbill-item-card" key={item.id}>
                  <div className="shbill-item-title">
                    <div className="shbill-item-number">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div>
                      <h3>
                        {item.description.trim() ||
                          `Exchange item ${index + 1}`}
                      </h3>
                      <p>Enter the details of the item received.</p>
                    </div>

                    <button
                      type="button"
                      className="shbill-remove-button"
                      onClick={() => removeExchangeItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="shbill-fields-grid shbill-item-fields">
                    <label className="shbill-field">
                      <span>Exchange type</span>

                      <select
                        value={item.metal}
                        onChange={(e) =>
                          updateExchangeItem(
                            item.id,
                            "metal",
                            e.target.value
                          )
                        }
                      >
                        <option>Gold</option>
                        <option>Silver</option>
                        <option>Other</option>
                      </select>
                    </label>

                    <label className="shbill-field">
                      <span>
                        Description <b>*</b>
                      </span>

                      <input
                        value={item.description}
                        onChange={(e) =>
                          updateExchangeItem(
                            item.id,
                            "description",
                            e.target.value
                          )
                        }
                        placeholder="e.g. Old gold chain"
                      />
                    </label>
                    {(item.metal === "Silver" || item.metal === "Other") && (
                      <label className="shbill-field">
                        <span>
                          Purity (%)<b>*</b>
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.itemPurity}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "purity",
                              e.target.value.replace(/[^0-9.]/g, "")
                            )
                          }
                          placeholder="Enter purity (e.g. 91.6)"
                        />
                      </label>
                    )}
                    {item.metal === "Gold" &&
                      (
                        <label className="shbill-field">
                          <span>
                            Purity / Karat <b>*</b>
                          </span>

                          <select
                            value={item.purity}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "purity",
                                e.target.value
                              )
                            }
                          >
                            <option value="24K">24K </option>
                            <option value="22K">22K </option>
                            <option value="20K">20K </option>
                            <option value="18K">18K </option>
                            <option value="14K">14K </option>
                            <option value="9K">9K </option>
                          </select>
                        </label>
                      )}

                    {/* OTHER ITEM: MANUAL EXCHANGE VALUE */}
                    {item.metal === "Other" ? (
                      <label className="shbill-field">
                        <span>
                          Exchange value <b>*</b>
                        </span>

                        <div className="shbill-input-unit">
                          <span>₹</span>

                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.manualValue}
                            onChange={(e) =>
                              updateExchangeItem(
                                item.id,
                                "manualValue",
                                e.target.value
                              )
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </label>
                    ) : (
                      <>
                        {/* GROSS WEIGHT */}
                        <label className="shbill-field">
                          <span>
                            Gross weight <b>*</b>
                          </span>

                          <div className="shbill-input-unit">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.grossWeight}
                              onChange={(e) =>
                                updateExchangeItem(
                                  item.id,
                                  "grossWeight",
                                  e.target.value.replace(/[^0-9.]/g, "")
                                )
                              }
                              placeholder="0.000"
                            />
                            <span>g</span>
                          </div>
                        </label>

                        {/* DEDUCTION WEIGHT */}
                        <label className="shbill-field">
                          <span>Deduction weight</span>

                          <div className="shbill-input-unit">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.deductionWeight}
                              onChange={(e) =>
                                updateExchangeItem(
                                  item.id,
                                  "deductionWeight",
                                  e.target.value.replace(/[^0-9.]/g, "")
                                )
                              }
                              placeholder="0.000"
                            />
                            <span>g</span>
                          </div>
                        </label>

                        {/* NET WEIGHT */}
                        <label className="shbill-field">
                          <span>Net weight</span>

                          <input
                            value={`${item.netWeight.toFixed(3)} g`}
                            readOnly
                          />
                        </label>

                        {/* RATE */}
                        <label className="shbill-field">
                          <span>
                            Rate per gram <b>*</b>
                          </span>

                          <div className="shbill-input-unit">
                            <span>₹</span>

                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.rate}
                              onChange={(e) =>
                                updateExchangeItem(
                                  item.id,
                                  "rate",
                                  e.target.value.replace(/[^0-9.]/g, "")
                                )
                              }
                              placeholder="0.00"
                            />
                          </div>
                        </label>
                      </>
                    )}
                    <div className="shbill-exchange-value">
                      <span>Calculated exchange value</span>
                      <strong>{money(item.exchangeValue)}</strong>
                    </div>
                  </div>
                </article>
              ))
            )}

            {exchangeTotal > 0 && (
              <div className="shbill-exchange-total">
                <span>Total exchange value</span>
                <strong>{money(exchangeTotal)}</strong>
              </div>
            )}
          </section>
        </div>

        <aside className="shbill-summary-column">
          <section className="shbill-summary-card">
            <div className="shbill-summary-heading">
              <span>✦</span>

              <div>
                <p>YOUR INVOICE</p>
                <h2>Bill summary</h2>
              </div>
            </div>

            <div className="shbill-total-panel">
              <span>Amount to collect</span>
              <strong>{money(totals.grandTotal)}</strong>

              <small>
                {items.length} {items.length === 1 ? "item" : "items"} on
                this bill
              </small>
            </div>

            <div className="shbill-summary-rows">
              <div>
                <span>Subtotal</span>
                <strong>{money(totals.subtotal)}</strong>
              </div>

              <label>
                <span>Discount</span>

                <div className="shbill-discount-input">
                  <span>₹</span>

                  <input
                    aria-label="Discount in rupees"
                    type="text"
                    inputMode="decimal"
                    value={discount}
                    onChange={(e) => {
                      setDiscount(
                        e.target.value.replace(/[^0-9.]/g, "")
                      );
                      clearNotice();
                    }}
                    placeholder="0.00"
                  />
                </div>
              </label>
              <div>
                <span>After discount</span>
                <strong>{money(totals.taxableAmount)}</strong>
              </div>

              {billingType === "GST" && (
                <div>
                  <span>
                    GST <small>(3% demo)</small>
                  </span>

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
                  <span>Less: Exchange Value</span>
                  <strong className="shbill-exchange-deduction">
                    - {money(exchangeTotal)}
                  </strong>
                </div>

                <div className="shbill-grand-total shbill-net-payable">
                  <span>Net Payable</span>
                  <strong>{money(netPayable)}</strong>
                </div>
              </>
            )}

            <label className="shbill-field">
              <span>Paid Amount (₹)</span>

              <input
                type="number"
                min="0"
                step="0.01"
                max={netPayable}
                value={paidAmount}
                onChange={(e) => {
                  setPaidAmount(e.target.value);
                  clearNotice();
                }}
                placeholder="Enter amount received"
              />
            </label>

            <div className="shbill-summary-row">
              <span>Due Amount</span>

              <strong>
                ₹{" "}
                {dueAmount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>

            <p className="shbill-tax-note">
              GST is currently set to a demonstration rate of 3%.
            </p>

            {notice && (
              <div
                className={`shbill-notice ${noticeType}`}
                role="status"
              >
                {notice}
              </div>
            )}

            <button
              className="shbill-secondary-button"
              type="button"
              onClick={previewPDF}
            >
              ▣ &nbsp; Preview PDF
            </button>

            <button
              className="shbill-primary-button"
              type="button"
              onClick={downloadPDF}
              disabled={isSaving}
            >
              {isSaving ? "Saving Bill..." : "✓ Save / PDF"}
            </button>

            <p className="shbill-help-text">
              Tip: review the customer name, weight and rate before printing.
            </p>
          </section>
        </aside>
      </form>

      <footer className="shbill-footer">
        <span>✦ PRANALI JEWELLERS</span>
        <span>Clear billing. Confident customers.</span>
      </footer>

      {previewOpen && (
        <div
          className="shbill-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="PDF Preview"
        >
          <section className="shbill-preview-modal">
            <header className="shbill-preview-header">
              <div>
                <strong>Invoice Preview</strong>
                <small>
                  Bill {billNumber} · A4 landscape · one page
                </small>
              </div>

              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label="Close preview"
              >
                ×
              </button>
            </header>

            <iframe
              title="Pranali Jewellers PDF preview"
              src={previewUrl}
            />

            <footer className="shbill-preview-actions">
              <button
                type="button"
                className="shbill-secondary-button"
                onClick={() => setPreviewOpen(false)}
              >
                Close
              </button>

              <button
                type="button"
                className="shbill-primary-button"
                onClick={downloadPDF}
                disabled={isSaving}
              >
                Download PDF
              </button>

              <button
                type="button"
                className="shbill-primary-button"
                onClick={() => {
                  const w = window.open(previewUrl, "_blank");

                  if (!w) {
                    setNotice(
                      "Allow pop-ups to open the PDF for printing."
                    );

                    setNoticeType("error");
                  }
                }}
              >
                Open to Print
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}