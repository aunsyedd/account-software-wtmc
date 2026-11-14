/* eslint-disable @next/next/no-img-element */
import { BANK, SELLER, fmt, fmtQty, type TaxInvoiceData, type TaxInvoiceParty } from "@/lib/taxInvoice";

function Field({ en, ar, value, valueAr }: { en: string; ar: string; value: React.ReactNode; valueAr?: string }) {
  return (
    <>
      <tr>
        <td className="ti-field-label">
          {en} <span className="ar">{ar}</span>
        </td>
        <td className="ti-field-value">{value}</td>
      </tr>
      {valueAr ? (
        <tr>
          <td className="ti-field-label" />
          <td className="ti-field-value ar">{valueAr}</td>
        </tr>
      ) : null}
    </>
  );
}

function SellerColumn() {
  const s = SELLER;
  return (
    <table className="ti-party">
      <tbody>
        <tr>
          <td colSpan={2} className="ti-party-title">
            Seller: <span className="ar">المورد</span>
          </td>
        </tr>
        <Field en="Name" ar="الاسم" value={s.name} valueAr={s.nameAr} />
        <Field en="Building No." ar="رقم المبنى" value={s.buildingNo} />
        <Field
          en="Street"
          ar="الشارع"
          value={
            <>
              {s.street} | <span className="ar">{s.streetAr}</span>
            </>
          }
        />
        <Field
          en="District"
          ar="الحي"
          value={
            <>
              {s.district} | <span className="ar">{s.districtAr}</span>
            </>
          }
        />
        <Field en="Second No." ar="الرقم الفرعي" value={s.secondNo} />
        <Field en="Postal Code" ar="الرمز البريدي" value={s.postalCode} />
        <Field
          en="City"
          ar="المدينة"
          value={
            <>
              {s.city} | <span className="ar">{s.cityAr}</span>
            </>
          }
        />
        <Field en="VAT Id." ar="رقم ضريبة" value={s.vatId} />
        <Field en="Other Id." ar="معرف آخر" value={s.otherId} />
      </tbody>
    </table>
  );
}

function BuyerColumn({ b }: { b: TaxInvoiceParty }) {
  return (
    <table className="ti-party">
      <tbody>
        <tr>
          <td colSpan={2} className="ti-party-title">
            Buyer: <span className="ar">العميل</span>
          </td>
        </tr>
        <Field en="Name" ar="الاسم" value={b.name} valueAr={b.nameAr} />
        <Field en="Building No." ar="رقم المبنى" value={b.buildingNo} />
        <Field en="Street" ar="الشارع" value={b.street} />
        <Field en="District" ar="الحي" value={b.district} />
        <Field en="Second No." ar="الرقم الفرعي" value={b.secondNo} />
        <Field en="Postal Code" ar="الرمز البريدي" value={b.postalCode} />
        <Field en="City" ar="المدينة" value={b.city} />
        <Field en="VAT Id." ar="رقم ضريبة" value={b.vatId} />
        <Field en="Other Id." ar="معرف آخر" value={b.otherId} />
      </tbody>
    </table>
  );
}

const unitLabel = (u: string) => (u ? u.charAt(0).toUpperCase() + u.slice(1).toLowerCase() : "");

/** The printed Tax / Proforma Invoice, same layout as Nexora Invoices. */
export function TaxInvoice({ data }: { data: TaxInvoiceData }) {
  const isTax = data.variant === "tax";
  return (
    <div className="ti-scroll">
      {/* Nexora prints this sheet edge to edge on A4. */}
      <style>{`@page { size: A4; margin: 0; }`}</style>
      <article className="tax-invoice">
        <div className="ti-title">
          {isTax ? (
            <>
              Tax Invoice - <span className="ar">فاتورة ضريبية</span>
            </>
          ) : (
            <>
              Proforma Invoice - <span className="ar">فاتورة مبدئية</span>
            </>
          )}
        </div>

        <div className="ti-header">
          <div className="ti-logo">
            <img src="/logo.jpg" alt="WTMC Logo" />
          </div>
          <table className="ti-meta">
            <tbody>
              <tr>
                <td className="ti-meta-label">
                  Invoice No. <span className="ar">رقم الفاتورة</span>
                </td>
                <td>{data.invoiceNumber}</td>
              </tr>
              <tr>
                <td className="ti-meta-label">
                  Invoice Date <span className="ar">تاريخ إصدار</span>
                </td>
                <td>{data.invoiceDate}</td>
              </tr>
              <tr>
                <td className="ti-meta-label">
                  Invoice Due Date <span className="ar">تاريخ الاستحقاق</span>
                </td>
                <td>{data.dueDate}</td>
              </tr>
              <tr>
                <td className="ti-meta-label">
                  Payment Terms <span className="ar">الشروط الدفع</span>
                </td>
                <td>{data.paymentTerms}</td>
              </tr>
            </tbody>
          </table>
          <div className="ti-qr">
            {data.qrSvg ? (
              <div className="ti-qr-img" role="img" aria-label="ZATCA QR code" dangerouslySetInnerHTML={{ __html: data.qrSvg }} />
            ) : data.qrError ? (
              <div className="ti-qr-error">{data.qrError}</div>
            ) : null}
          </div>
        </div>

        <div className="ti-parties">
          <SellerColumn />
          <BuyerColumn b={data.buyer} />
        </div>

        {data.description ? (
          <table className="ti-detail">
            <tbody>
              <tr>
                <td className="ti-detail-label">Description</td>
                <td>{data.description}</td>
              </tr>
            </tbody>
          </table>
        ) : null}

        {data.poNumber || data.projectName ? (
          <table className="ti-detail">
            <tbody>
              <tr>
                <td style={{ width: "50%" }}>
                  {data.poNumber ? (
                    <>
                      <strong>P.O.No.:</strong> {data.poNumber}
                    </>
                  ) : null}
                </td>
                <td style={{ width: "50%" }}>
                  {data.projectName ? (
                    <>
                      <strong>Project :</strong> {data.projectName}
                    </>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        ) : null}

        <table className="ti-items">
          <thead>
            <tr>
              <th style={{ width: "4%" }}>
                #<br />
                <span className="ar">رقم</span>
              </th>
              <th style={{ width: "34%" }}>
                Descriptions
                <br />
                <span className="ar">الأوصاف</span>
              </th>
              <th style={{ width: "8%" }}>
                Unit
                <br />
                <span className="ar">الوحدة</span>
              </th>
              <th style={{ width: "7%" }}>
                QTY
                <br />
                <span className="ar">الكمية</span>
              </th>
              <th style={{ width: "12%" }}>
                Unit Price
                <br />
                <span className="ar">سعر الوحدة</span>
              </th>
              <th style={{ width: "13%" }}>
                Taxable Amount
                <br />
                <span className="ar">المبلغ الخاضع للضريبة</span>
              </th>
              <th style={{ width: "10%" }}>
                Tax
                <br />
                <span className="ar">ضريبة</span>
              </th>
              <th style={{ width: "12%" }}>
                Total
                <br />
                <span className="ar">الإجمالي</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.lines.length === 0 ? (
              <tr>
                <td colSpan={8} className="center">
                  No line items
                </td>
              </tr>
            ) : (
              data.lines.map((l, i) => (
                <tr key={i}>
                  <td className="center">{i + 1}</td>
                  <td>{l.description}</td>
                  <td className="center">{unitLabel(l.unit)}</td>
                  <td className="center">{fmtQty(l.qty)}</td>
                  <td className="num">{fmt(l.rate)}</td>
                  <td className="num">{fmt(l.amount)}</td>
                  <td className="num">{fmt(l.tax)}</td>
                  <td className="num">{fmt(l.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="ti-bottom">
          <div className="ti-note">
            <div className="ti-note-label">Note:</div>
            <div className="ti-note-text">{data.publicNote}</div>
          </div>
          <table className="ti-summary">
            <tbody>
              <tr>
                <td className="ti-sum-label">
                  Amount <span className="ar">المبلغ</span>
                </td>
                <td className="ti-sum-value">{fmt(data.amount)}</td>
              </tr>
              {data.discount > 0 ? (
                <>
                  <tr>
                    <td className="ti-sum-label">
                      Discount <span className="ar">خصم</span>
                    </td>
                    <td className="ti-sum-value">{fmt(data.discount)}</td>
                  </tr>
                  <tr>
                    <td className="ti-sum-label">
                      Total Amount <span className="ar">الإجمالي المبلغ</span>
                    </td>
                    <td className="ti-sum-value">{fmt(data.amount - data.discount)}</td>
                  </tr>
                </>
              ) : null}
              <tr>
                <td className="ti-sum-label">
                  VAT 15% <span className="ar">ضريبة القيمة المضافة</span>
                </td>
                <td className="ti-sum-value">{fmt(data.vat)}</td>
              </tr>
              <tr>
                <td className="ti-sum-label">
                  Net Amount <span className="ar">الصافي المبلغ</span>
                </td>
                <td className="ti-sum-value">{fmt(data.net)}</td>
              </tr>
              {data.retention > 0 ? (
                <tr>
                  <td className="ti-sum-label">
                    Retention{data.retentionPercentage > 0 ? ` (${data.retentionPercentage}% of Total Amount)` : ""}{" "}
                    <span className="ar">نسبة الاحتفاظ</span>
                  </td>
                  <td className="ti-sum-value">-{fmt(data.retention)}</td>
                </tr>
              ) : null}
              <tr>
                <td className="ti-sum-label">
                  Amount Due <span className="ar">المستحق المبلغ</span>
                </td>
                <td className="ti-sum-value">{fmt(data.due)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ti-bank">
          <div>Payment Terms</div>
          <div>Payment by bank transfer to the following account:</div>
          <div>Bank Name: {BANK.bankName}</div>
          <div>Account Number: {BANK.accountNumber}</div>
          <div>Account Name: {BANK.accountName}</div>
          <div>IBAN: {BANK.iban}</div>
        </div>

        <div className="ti-signature">
          <div className="ti-sign-left">For {SELLER.name}</div>
          <div className="ti-sign-right">Received By</div>
        </div>

        <div className="ti-footer">
          <span>VAT ID: {SELLER.vatId}</span>
          <span>Page 1/1</span>
        </div>
      </article>
    </div>
  );
}
