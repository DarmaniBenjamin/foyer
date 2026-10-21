// What guests see on their phone when they join a site's Wi-Fi: the
// sign-in page, or (page="success") the page after they're connected.
// The Sites editor shows it live as you change things.
import { useState } from "react";
import { CircleCheck, Wifi } from "lucide-react";
import { textOn } from "../data";

function Question({ field, color }) {
  const box =
    "h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-base text-gray-900 outline-none focus:border-current";
  const label = (
    <span className="mb-1 block text-sm font-medium text-gray-800">
      {field.label || "Untitled question"}
      {field.required && <span className="text-red-500"> *</span>}
    </span>
  );

  if (field.type === "checkbox")
    return (
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          style={{ accentColor: color }}
        />
        <span>
          {field.label || "Untitled question"}
          {field.required && <span className="text-red-500"> *</span>}
        </span>
      </label>
    );

  if (field.type === "choice")
    return (
      <label className="block">
        {label}
        <select className={box} style={{ color: "#111827" }} defaultValue="">
          <option value="" disabled>
            Choose one
          </option>
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
    );

  return (
    <label className="block">
      {label}
      <input
        type={field.type === "phone" ? "tel" : field.type}
        className={box}
        style={{ color: "#111827" }}
      />
    </label>
  );
}

export default function PortalPreview({ site, page = "signin", onConnect }) {
  const { look } = site;
  const [showTerms, setShowTerms] = useState(false);
  const buttonStyle = { backgroundColor: look.color, color: textOn(look.color) };

  return (
    <div
      className="flex min-h-full flex-col items-center px-4 py-8"
      style={{ backgroundColor: look.background }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-lg shadow-black/5">
        <div className="mb-5 flex justify-center">
          {look.logo ? (
            <img
              src={look.logo}
              alt={site.name}
              className="max-h-20 max-w-[70%] object-contain"
            />
          ) : (
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={buttonStyle}
            >
              <Wifi size={28} />
            </span>
          )}
        </div>

        {page === "success" ? (
          <div className="text-center">
            <CircleCheck
              size={44}
              className="mx-auto mb-3"
              style={{ color: look.color }}
            />
            <h1 className="text-xl font-semibold text-gray-900">
              {site.name}
            </h1>
            <p className="mt-2 text-sm whitespace-pre-line text-gray-600">
              {look.success}
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onConnect?.();
            }}
          >
            <h1 className="text-center text-xl font-semibold text-gray-900">
              {look.heading}
            </h1>
            {look.message && (
              <p className="mt-2 text-center text-sm whitespace-pre-line text-gray-600">
                {look.message}
              </p>
            )}

            <div className="mt-5 space-y-3">
              {site.mode === "form" &&
                site.fields.map((field) => (
                  <Question key={field.key} field={field} color={look.color} />
                ))}

              {site.mode === "voucher" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-800">
                    Voucher code
                  </span>
                  <input
                    className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-center font-mono text-base tracking-widest text-gray-900 uppercase outline-none"
                    placeholder="ABCD-1234"
                    autoCapitalize="characters"
                  />
                </label>
              )}

              {site.requireTerms && (
                <div>
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      style={{ accentColor: look.color }}
                    />
                    <span>
                      I accept the{" "}
                      <button
                        type="button"
                        onClick={() => setShowTerms((s) => !s)}
                        className="font-medium underline"
                        style={{ color: look.color }}
                      >
                        terms of use
                      </button>
                    </span>
                  </label>
                  {showTerms && (
                    <p className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-gray-50 p-3 text-xs whitespace-pre-line text-gray-600">
                      {look.terms}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="mt-5 h-12 w-full rounded-xl text-base font-semibold transition active:scale-[0.98]"
              style={buttonStyle}
            >
              {look.button || "Connect"}
            </button>
          </form>
        )}
      </div>
      <p className="mt-6 text-xs text-gray-500">Free Wi-Fi · {site.name}</p>
    </div>
  );
}