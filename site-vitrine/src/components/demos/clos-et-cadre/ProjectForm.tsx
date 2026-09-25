"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/tracking";
import { COMMUNE_NAMES, COMPANY, CASE_STUDY_PATH, DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";
import {
  BUDGETS,
  CALLBACK_SLOTS,
  CONTACT_MODES,
  EMPTY_REQUEST,
  ERAS,
  OCCUPANCIES,
  OTHER_COMMUNE,
  PROGRESS,
  PROJECT_TYPES,
  PROPERTY_TYPES,
  STEP_FIELDS,
  TIMELINES,
  WORKS,
  createsSurface,
  formatPhone,
  labelOf,
  normalisePhone,
  validateFields,
  type FieldErrors,
  type ProjectBrief,
  type ProjectRequest,
  type RequestField,
} from "@/lib/demos/clos-et-cadre/request";

const STEPS = [
  { title: "Votre projet", hint: "Le type de travaux et de bien" },
  { title: "Le bien", hint: "Où, quand il a été construit, sa surface" },
  { title: "Vos attentes", hint: "Travaux, calendrier, enveloppe, photos" },
  { title: "Vos coordonnées", hint: "Pour que nous puissions vous rappeler" },
] as const;

const ENDPOINT = "/api/demonstrations/clos-et-cadre";
const MAX_PHOTOS = 12;
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

type Photo = { id: string; name: string; url: string };
type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string } | { kind: "success"; brief: ProjectBrief; request: ProjectRequest };

/* ------------------------------------------------------------------------ */
/* Field primitives                                                         */
/* ------------------------------------------------------------------------ */

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-[14.5px] text-[var(--cc-error)]">
      {message}
    </p>
  );
}

function Fieldset({ legend, hint, error, name, children }: { legend: string; hint?: string; error?: string; name: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0" aria-describedby={error ? `${name}-erreur` : undefined} data-field={name}>
      <legend className="text-[17px] font-medium">{legend}</legend>
      {hint && <p className="mt-1 text-[14.5px] text-[var(--cc-muted)]">{hint}</p>}
      <div className="mt-4">{children}</div>
      <FieldError id={`${name}-erreur`} message={error} />
    </fieldset>
  );
}

function Choice({
  type,
  name,
  checked,
  onChange,
  label,
  hint,
  wide = false,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label
      className={`relative flex min-h-12 cursor-pointer items-center gap-3 border px-4 py-3 text-[16px] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--cc-accent)] ${
        checked ? "border-[var(--cc-ink)] bg-[var(--cc-ink)] text-[var(--cc-bg)]" : "border-[var(--cc-line-strong)] bg-[var(--cc-bg)] hover:border-[var(--cc-ink)]"
      } ${wide ? "items-start" : ""}`}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${type === "radio" ? "rounded-full" : ""} ${
          checked ? "border-[var(--cc-bg)]" : "border-[var(--cc-line-strong)]"
        } ${wide ? "mt-1" : ""}`}
      >
        {checked && <span className={`h-2 w-2 bg-[var(--cc-bg)] ${type === "radio" ? "rounded-full" : ""}`} />}
      </span>
      <span>
        <span className="block">{label}</span>
        {hint && <span className={`block text-[14px] ${checked ? "text-[#cfc8bd]" : "text-[var(--cc-muted)]"}`}>{hint}</span>}
      </span>
    </label>
  );
}

const inputClass =
  "block min-h-12 w-full rounded-none border border-[var(--cc-line-strong)] bg-[var(--cc-bg)] px-4 text-[16px] text-[var(--cc-ink)] placeholder:text-[#8d857b] focus:border-[var(--cc-ink)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-accent)] aria-[invalid=true]:border-[var(--cc-error)]";

function TextField({
  name,
  label,
  hint,
  error,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  suffix,
  placeholder,
}: {
  name: RequestField;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
  suffix?: string;
  placeholder?: string;
}) {
  const id = `cc-${name}`;
  const describedBy = [hint ? `${id}-aide` : "", error ? `${name}-erreur` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div data-field={name}>
      <label htmlFor={id} className="block text-[17px] font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-aide`} className="mt-1 text-[14.5px] text-[var(--cc-muted)]">
          {hint}
        </p>
      )}
      <div className="relative mt-3">
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} ${suffix ? "pr-14" : ""}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[15px] text-[var(--cc-muted)]">{suffix}</span>}
      </div>
      <FieldError id={`${name}-erreur`} message={error} />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* The form                                                                 */
/* ------------------------------------------------------------------------ */

export function ProjectForm({ initialType }: { initialType?: string }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<ProjectRequest>(() => ({
    ...EMPTY_REQUEST,
    projectType: (PROJECT_TYPES.some((type) => type.value === initialType) ? initialType : "") as ProjectRequest["projectType"],
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [honeypot, setHoneypot] = useState("");
  const [started, setStarted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputId = useId();
  const firstRender = useRef(true);

  // Moving between steps: focus the step title so screen readers announce it
  // and keyboard users don't start from the bottom of the previous step.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (status.kind === "success" || status.kind === "error") resultRef.current?.focus();
  }, [status.kind]);

  // Object URLs are released when photos are removed or the form unmounts.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  function update<K extends keyof ProjectRequest>(key: K, value: ProjectRequest[K]) {
    if (!started) {
      setStarted(true);
      track("form_started", { form: "demo_clos_et_cadre" });
    }
    setData((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggle(key: "works" | "progress", value: string) {
    const list = data[key];
    let next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
    // "No steps taken yet" excludes the others, and vice versa.
    if (key === "progress") {
      next = value === "aucune" && !list.includes("aucune") ? ["aucune"] : next.filter((item) => value === "aucune" || item !== "aucune");
    }
    update(key, next);
  }

  function focusFirstError(fieldErrors: FieldErrors) {
    const first = STEP_FIELDS.flat().find((field) => fieldErrors[field]);
    if (!first) return;
    const container = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
    const target = container?.querySelector<HTMLElement>("input, select, textarea") ?? container;
    target?.focus();
  }

  function next() {
    const stepErrors = validateFields(data, STEP_FIELDS[step]);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      focusFirstError(stepErrors);
      return;
    }
    setErrors({});
    setStep((current) => current + 1);
    window.scrollTo({ top: (formRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 110, behavior: "smooth" });
  }

  function back() {
    setErrors({});
    setStep((current) => Math.max(0, current - 1));
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoError(null);
    const accepted: Photo[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        setPhotoError("Seules les images sont acceptées (JPEG, PNG, HEIC…).");
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError(`« ${file.name} » dépasse 12 Mo.`);
        continue;
      }
      accepted.push({ id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, url: URL.createObjectURL(file) });
    }
    setPhotos((current) => {
      const merged = [...current];
      for (const photo of accepted) {
        if (merged.some((existing) => existing.id === photo.id) || merged.length >= MAX_PHOTOS) {
          URL.revokeObjectURL(photo.url);
          if (merged.length >= MAX_PHOTOS) setPhotoError(`${MAX_PHOTOS} photos maximum.`);
          continue;
        }
        merged.push(photo);
      }
      return merged;
    });
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return current.filter((item) => item.id !== id);
    });
  }

  async function submit() {
    const stepErrors = validateFields(data, STEP_FIELDS[3]);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      focusFirstError(stepErrors);
      return;
    }
    setErrors({});
    setStatus({ kind: "submitting" });
    const payload = { ...data, photoCount: photos.length, website: honeypot };

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { brief?: ProjectBrief; errors?: FieldErrors; error?: string } | null;

      if (response.ok && body?.brief) {
        track("form_completed", { form: "demo_clos_et_cadre", priority: body.brief.priority });
        setStatus({ kind: "success", brief: body.brief, request: payload });
        return;
      }
      if (response.status === 400 && body?.errors) {
        // Server-side validation disagrees: send the visitor back to the first faulty step.
        setErrors(body.errors);
        const faultyStep = STEP_FIELDS.findIndex((fields) => fields.some((field) => body.errors?.[field]));
        setStatus({ kind: "idle" });
        if (faultyStep >= 0) setStep(faultyStep);
        return;
      }
      setStatus({
        kind: "error",
        message:
          response.status === 429
            ? "Trop de demandes envoyées depuis votre connexion. Patientez quelques minutes, ou appelez-nous directement."
            : "Votre demande n'a pas pu être envoyée. Vos réponses sont conservées : vous pouvez réessayer.",
      });
    } catch {
      setStatus({ kind: "error", message: "Connexion interrompue. Vos réponses sont conservées : vérifiez votre réseau et réessayez." });
    }
  }

  if (status.kind === "success") {
    return <Success brief={status.brief} request={status.request} photos={photos} resultRef={resultRef} />;
  }

  const current = STEPS[step];
  const submitting = status.kind === "submitting";

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (step < STEPS.length - 1) next();
        else void submit();
      }}
      aria-busy={submitting}
    >
      {/* Progress */}
      <ol className="grid grid-cols-4 gap-2" aria-label="Étapes de la demande">
        {STEPS.map((item, index) => (
          <li key={item.title} aria-current={index === step ? "step" : undefined}>
            <span className={`block h-[3px] transition-colors ${index <= step ? "bg-[var(--cc-ink)]" : "bg-[var(--cc-line)]"}`} />
            <span className={`mt-2 hidden text-[13px] sm:block ${index === step ? "text-[var(--cc-ink)]" : "text-[var(--cc-muted)]"}`}>{item.title}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <p className="text-[14px] text-[var(--cc-muted)]">
          Étape {step + 1} sur {STEPS.length}
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="cc-serif mt-1 text-[32px] leading-tight focus:outline-none sm:text-[38px]">
          {current.title}
        </h2>
        <p className="mt-1 text-[16px] text-[var(--cc-muted)]">{current.hint}</p>
      </div>

      <div className="mt-10 space-y-10">
        {step === 0 && (
          <>
            <Fieldset legend="Quel est votre projet ?" name="projectType" error={errors.projectType}>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROJECT_TYPES.map((type) => (
                  <Choice key={type.value} type="radio" name="projectType" wide checked={data.projectType === type.value} onChange={() => update("projectType", type.value)} label={type.label} hint={type.hint} />
                ))}
              </div>
            </Fieldset>
            <Fieldset legend="Il s'agit" name="propertyType" error={errors.propertyType}>
              <div className="grid grid-cols-2 gap-2">
                {PROPERTY_TYPES.map((type) => (
                  <Choice key={type.value} type="radio" name="propertyType" checked={data.propertyType === type.value} onChange={() => update("propertyType", type.value)} label={`D'une ${type.label.toLowerCase()}`} />
                ))}
              </div>
            </Fieldset>
          </>
        )}

        {step === 1 && (
          <>
            <div data-field="commune">
              <label htmlFor="cc-commune" className="block text-[17px] font-medium">
                Commune du bien
              </label>
              <p id="cc-commune-aide" className="mt-1 text-[14.5px] text-[var(--cc-muted)]">
                Pour vérifier la zone et les règles d&apos;urbanisme qui s&apos;appliquent.
              </p>
              <select
                id="cc-commune"
                value={data.commune}
                onChange={(event) => update("commune", event.target.value)}
                aria-invalid={errors.commune ? true : undefined}
                aria-describedby={`cc-commune-aide${errors.commune ? " commune-erreur" : ""}`}
                className={`${inputClass} mt-3 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22><path d=%22M5 8l5 5 5-5%22 fill=%22none%22 stroke=%22%235c554d%22 stroke-width=%221.5%22/></svg>')] bg-[length:20px] bg-[right_14px_center] bg-no-repeat pr-12`}
              >
                <option value="">Choisir une commune</option>
                {COMMUNE_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value={OTHER_COMMUNE}>Une autre commune</option>
              </select>
              <FieldError id="commune-erreur" message={errors.commune} />
            </div>
            {data.commune === OTHER_COMMUNE && (
              <TextField name="otherCommune" label="Laquelle ?" error={errors.otherCommune} value={data.otherCommune} onChange={(value) => update("otherCommune", value)} autoComplete="address-level2" />
            )}
            <Fieldset legend="Époque de construction" hint="Une estimation suffit : elle renseigne sur les matériaux et la structure." name="era" error={errors.era}>
              <div className="flex flex-wrap gap-2">
                {ERAS.map((era) => (
                  <Choice key={era.value} type="radio" name="era" checked={data.era === era.value} onChange={() => update("era", era.value)} label={era.label} />
                ))}
              </div>
            </Fieldset>
            <div className="grid gap-8 sm:grid-cols-2">
              <TextField
                name="currentSurface"
                label="Surface actuelle"
                hint="Surface habitable approximative."
                error={errors.currentSurface}
                value={data.currentSurface === null ? "" : String(data.currentSurface)}
                onChange={(value) => update("currentSurface", value === "" ? null : Number(value.replace(",", ".")))}
                inputMode="numeric"
                suffix="m²"
              />
              {createsSurface(data.projectType) && (
                <TextField
                  name="addedSurface"
                  label="Surface à créer"
                  hint="Facultatif — laissez vide si vous ne savez pas."
                  error={errors.addedSurface}
                  value={data.addedSurface === null ? "" : String(data.addedSurface)}
                  onChange={(value) => update("addedSurface", value === "" ? null : Number(value.replace(",", ".")))}
                  inputMode="numeric"
                  suffix="m²"
                />
              )}
            </div>
            <Fieldset legend="Aujourd'hui, le logement" name="occupancy" error={errors.occupancy}>
              <div className="grid gap-2 sm:grid-cols-3">
                {OCCUPANCIES.map((item) => (
                  <Choice key={item.value} type="radio" name="occupancy" checked={data.occupancy === item.value} onChange={() => update("occupancy", item.value)} label={item.label} />
                ))}
              </div>
            </Fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <Fieldset legend="Travaux envisagés" hint="Plusieurs choix possibles, facultatif." name="works" error={errors.works}>
              <div className="flex flex-wrap gap-2">
                {WORKS.map((work) => (
                  <Choice key={work} type="checkbox" name="works" checked={data.works.includes(work)} onChange={() => toggle("works", work)} label={work} />
                ))}
              </div>
            </Fieldset>
            <Fieldset legend="Où en êtes-vous ?" hint="Plusieurs choix possibles." name="progress" error={errors.progress}>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROGRESS.map((item) => (
                  <Choice key={item.value} type="checkbox" name="progress" checked={data.progress.includes(item.value)} onChange={() => toggle("progress", item.value)} label={item.label} />
                ))}
              </div>
            </Fieldset>
            <Fieldset legend="Quand souhaitez-vous démarrer ?" name="timeline" error={errors.timeline}>
              <div className="flex flex-wrap gap-2">
                {TIMELINES.map((item) => (
                  <Choice key={item.value} type="radio" name="timeline" checked={data.timeline === item.value} onChange={() => update("timeline", item.value)} label={item.label} />
                ))}
              </div>
            </Fieldset>
            <Fieldset
              legend="Enveloppe envisagée pour les travaux"
              hint="Elle nous permet de vous proposer des solutions réalistes dès le premier appel. Vous pouvez répondre « Je ne sais pas encore »."
              name="budget"
              error={errors.budget}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {BUDGETS.map((item) => (
                  <Choice key={item.value} type="radio" name="budget" checked={data.budget === item.value} onChange={() => update("budget", item.value)} label={item.label} />
                ))}
              </div>
            </Fieldset>
            <div data-field="description">
              <label htmlFor="cc-description" className="block text-[17px] font-medium">
                Votre projet en quelques mots
              </label>
              <p id="cc-description-aide" className="mt-1 text-[14.5px] text-[var(--cc-muted)]">
                Facultatif : ce qui ne vous convient plus, ce que vous imaginez, une contrainte particulière.
              </p>
              <textarea
                id="cc-description"
                rows={5}
                maxLength={2000}
                value={data.description}
                onChange={(event) => update("description", event.target.value)}
                aria-describedby="cc-description-aide"
                className={`${inputClass} mt-3 py-3 leading-relaxed`}
              />
              <p className="mt-1 text-right text-[13px] tabular-nums text-[var(--cc-muted)]">{data.description.length} / 2000</p>
            </div>
            <div>
              <p className="text-[17px] font-medium">Photos de l&apos;existant</p>
              <p className="mt-1 text-[14.5px] text-[var(--cc-muted)]">
                Facultatif mais précieux : façade, pièces concernées, jardin. Jusqu&apos;à {MAX_PHOTOS} photos.
              </p>
              <label
                htmlFor={fileInputId}
                className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-[var(--cc-line-strong)] px-4 py-5 text-center hover:border-[var(--cc-ink)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--cc-accent)]"
              >
                <span className="text-[16px] font-medium">Ajouter des photos</span>
                <span className="text-[14px] text-[var(--cc-muted)]">Depuis votre téléphone ou votre ordinateur</span>
                <input id={fileInputId} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} />
              </label>
              {photoError && <p className="mt-2 text-[14.5px] text-[var(--cc-error)]" role="alert">{photoError}</p>}
              {photos.length > 0 && (
                <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <li key={photo.id} className="relative aspect-square overflow-hidden bg-[var(--cc-paper)]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, nothing to optimise */}
                      <img src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center bg-[var(--cc-ink)]/85 text-[var(--cc-bg)]"
                        aria-label={`Retirer ${photo.name}`}
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M5 5l10 10M15 5L5 15" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="grid gap-8 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField name="name" label="Nom et prénom" error={errors.name} value={data.name} onChange={(value) => update("name", value)} autoComplete="name" />
              </div>
              <TextField name="phone" label="Téléphone" type="tel" error={errors.phone} value={data.phone} onChange={(value) => update("phone", value)} autoComplete="tel" inputMode="tel" />
              <TextField name="email" label="Email" type="email" error={errors.email} value={data.email} onChange={(value) => update("email", value)} autoComplete="email" inputMode="email" />
            </div>
            <Fieldset legend="Meilleur moment pour vous rappeler" name="callbackSlot" error={errors.callbackSlot}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CALLBACK_SLOTS.map((slot) => (
                  <Choice key={slot.value} type="radio" name="callbackSlot" wide checked={data.callbackSlot === slot.value} onChange={() => update("callbackSlot", slot.value)} label={slot.label} hint={slot.hint} />
                ))}
              </div>
            </Fieldset>
            <Fieldset legend="Pour le premier échange, vous préférez" name="contactMode" error={errors.contactMode}>
              <div className="grid gap-2 sm:grid-cols-3">
                {CONTACT_MODES.map((mode) => (
                  <Choice key={mode.value} type="radio" name="contactMode" checked={data.contactMode === mode.value} onChange={() => update("contactMode", mode.value)} label={mode.label} />
                ))}
              </div>
            </Fieldset>
            {/* Honeypot: invisible to people, tempting to bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="cc-website">Site web</label>
              <input id="cc-website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
            </div>
            <div data-field="consent">
              <label className="flex cursor-pointer gap-3 text-[15.5px] leading-relaxed">
                <input
                  type="checkbox"
                  checked={data.consent}
                  onChange={(event) => update("consent", event.target.checked)}
                  aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={errors.consent ? "consent-erreur" : undefined}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--cc-ink)]"
                />
                <span>
                  J&apos;accepte que {COMPANY.name} utilise ces informations pour étudier mon projet et me recontacter. Elles ne sont jamais
                  transmises à des tiers.
                </span>
              </label>
              <FieldError id="consent-erreur" message={errors.consent} />
            </div>
          </>
        )}
      </div>

      {status.kind === "error" && (
        <div ref={resultRef} tabIndex={-1} role="alert" className="mt-10 border-l-2 border-[var(--cc-error)] bg-[#a23a2a0d] px-5 py-4 focus:outline-none">
          <p className="font-medium text-[var(--cc-error)]">{status.message}</p>
          <p className="mt-1 text-[15px] text-[var(--cc-muted)]">
            Vous pouvez aussi nous appeler au{" "}
            <a href={COMPANY.phoneHref} className="cc-link text-[var(--cc-ink)]">
              {COMPANY.phoneDisplay}
            </a>
            .
          </p>
        </div>
      )}

      <div className="mt-12 flex flex-col-reverse gap-3 border-t border-[var(--cc-line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
        {step > 0 ? (
          <button type="button" onClick={back} disabled={submitting} className="min-h-12 px-2 text-left text-[15px] text-[var(--cc-muted)] hover:text-[var(--cc-ink)] disabled:opacity-50">
            ← Étape précédente
          </button>
        ) : (
          <span className="text-[14px] text-[var(--cc-muted)]">Environ 4 minutes</span>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-14 items-center justify-center gap-3 bg-[var(--cc-ink)] px-8 text-[16px] font-medium text-[var(--cc-bg)] transition-colors hover:bg-[var(--cc-accent)] disabled:cursor-progress disabled:bg-[var(--cc-muted)]"
        >
          {submitting && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--cc-bg)] border-t-transparent" />}
          {step < STEPS.length - 1 ? "Continuer" : submitting ? "Envoi en cours…" : status.kind === "error" ? "Réessayer l'envoi" : "Envoyer ma demande"}
        </button>
      </div>
      {step === STEPS.length - 1 && (
        <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--cc-muted)]">
          Démonstration : votre demande n&apos;est ni transmise ni conservée. Elle sert uniquement à générer la fiche projet que recevrait
          l&apos;entreprise.
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {submitting ? "Envoi de votre demande en cours." : ""}
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* Success: the visitor's confirmation, then what the company receives.     */
/* ------------------------------------------------------------------------ */

const TONE = {
  positive: "bg-[#3f6b4a]",
  neutral: "bg-[#8d857b]",
  attention: "bg-[#c17a2b]",
} as const;

function Success({ brief, request, photos, resultRef }: { brief: ProjectBrief; request: ProjectRequest; photos: Photo[]; resultRef: React.RefObject<HTMLDivElement | null> }) {
  const firstName = request.name.trim().split(/\s+/)[0];
  const commune = request.commune === OTHER_COMMUNE ? request.otherCommune : request.commune;
  return (
    <div>
      <div ref={resultRef} tabIndex={-1} className="focus:outline-none" role="status">
        <p className="cc-label text-[var(--cc-ok)]">Demande reçue · {brief.reference}</p>
        <h2 className="cc-serif mt-3 text-[34px] leading-tight sm:text-[42px]">Merci {firstName}. Nous examinons votre projet.</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-[var(--cc-muted)]">
          Le conducteur de travaux de votre secteur étudie votre demande{photos.length > 0 ? " et vos photos" : ""} et revient vers vous sous
          deux jours ouvrés, {labelOf(CALLBACK_SLOTS, request.callbackSlot).toLowerCase()}, {labelOf(CONTACT_MODES, request.contactMode).toLowerCase()}.
          Il vous appellera au {formatPhone(normalisePhone(request.phone) ?? request.phone)}.
        </p>
      </div>

      <dl className="mt-10 grid gap-x-8 border-t border-[var(--cc-line)] sm:grid-cols-2">
        {[
          ["Projet", `${labelOf(PROJECT_TYPES, request.projectType)} — ${labelOf(PROPERTY_TYPES, request.propertyType).toLowerCase()}`],
          ["Commune", commune],
          ["Surfaces", `${request.currentSurface} m²${request.addedSurface ? ` + ${request.addedSurface} m² à créer` : ""}`],
          ["Démarrage", labelOf(TIMELINES, request.timeline)],
          ["Enveloppe", labelOf(BUDGETS, request.budget)],
          ["Photos", photos.length > 0 ? `${photos.length} jointe${photos.length > 1 ? "s" : ""}` : "Aucune"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-[var(--cc-line)] py-3 text-[15px]">
            <dt className="text-[var(--cc-muted)]">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 text-[15px] text-[var(--cc-muted)]">
        En attendant, parcourez les{" "}
        <Link href={`${DEMO_BASE_PATH}/realisations`} className="cc-link text-[var(--cc-ink)]">
          réalisations comparables
        </Link>
        .
      </p>

      {/* GC demonstration layer: what the company would receive. */}
      <section aria-labelledby="fiche-titre" className="mt-14 bg-[#0b0b0b] p-6 text-[#e9e6df] sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e5b94a]">Démonstration GC · côté entreprise</p>
        <h2 id="fiche-titre" className="mt-3 text-[22px] font-medium leading-snug sm:text-[26px]">
          La fiche projet que reçoit {COMPANY.name}, avant de décrocher son téléphone.
        </h2>
        <div className="mt-6 border border-white/10 bg-[#141414] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[13px] text-[#9a968e]">{brief.reference}</p>
              <p className="mt-1 text-[17px] font-medium">{brief.headline}</p>
            </div>
            <p className="flex items-center gap-2 border border-white/15 px-3 py-1.5 text-[14px]">
              <span className="text-[20px] font-semibold leading-none text-[#e5b94a]">{brief.priority}</span>
              <span className="text-[#c9c5bc]">{brief.priorityLabel}</span>
            </p>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {brief.signals.map((signal) => (
              <li key={signal.label} className="flex gap-3">
                <span aria-hidden="true" className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${TONE[signal.tone]}`} />
                <span>
                  <span className="block text-[15px] text-white">{signal.label}</span>
                  <span className="block text-[14px] leading-relaxed text-[#9a968e]">{signal.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          {brief.checklist.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-[12px] uppercase tracking-[0.16em] text-[#9a968e]">À préparer pour l&apos;appel</p>
              <ul className="mt-2 space-y-1.5 text-[14.5px]">
                {brief.checklist.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-[#e5b94a]">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-6 border-t border-white/10 pt-4 text-[15px]">
            <span className="text-[#9a968e]">Prochaine action : </span>
            {brief.nextAction}
          </p>
        </div>
        <p className="mt-5 text-[14px] leading-relaxed text-[#9a968e]">
          Rien n&apos;a été transmis ni conservé. Sur un déploiement réel, cette fiche arrive par email et dans le CRM de l&apos;entreprise,
          avec les photos.{" "}
          <Link href={CASE_STUDY_PATH} className="text-[#e9e6df] underline decoration-[#e5b94a]/60 underline-offset-4">
            Lire l&apos;étude de cas
          </Link>
        </p>
      </section>
    </div>
  );
}
