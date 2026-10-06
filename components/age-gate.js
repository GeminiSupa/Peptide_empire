'use client';

import { useEffect, useState } from 'react';

const COPY = {
  en: {
    title: 'Research Use Only | 21+ to Enter',
    intro: 'Please confirm your age and acknowledge the research-only use of our products before entering.',
    confirm: 'I confirm that I am at least 21 years old and agree to the research use terms.',
    disagree: 'No, I Disagree',
    agree: 'Yes, I Agree',
    remember: 'Remember my choice',
    legal:
      'By selecting “Yes, I Agree,” you confirm that you are at least 21 years old and acknowledge the following: Products are supplied strictly for laboratory research and are not intended for human or animal consumption, treatment, or personal use. You understand that research materials require appropriate knowledge, facilities, and handling precautions. You agree to follow applicable laws and the product-specific handling and safety information. Peptides Costa Rica reserves the right to decline or cancel orders where human or animal use is suspected.',
  },
  es: {
    title: 'Solo para investigación | Mayores de 21 años',
    intro: 'Confirma tu edad y reconoce el uso exclusivo para investigación de nuestros productos antes de ingresar.',
    confirm: 'Confirmo que tengo al menos 21 años y acepto los términos de uso para investigación.',
    disagree: 'No, no acepto',
    agree: 'Sí, acepto',
    remember: 'Recordar mi elección',
    legal:
      'Al seleccionar “Sí, acepto”, confirmas que tienes al menos 21 años y reconoces lo siguiente: Los productos se suministran estrictamente para investigación de laboratorio y no están destinados al consumo humano o animal, tratamiento o uso personal. Comprendes que los materiales de investigación requieren conocimientos, instalaciones y precauciones de manejo adecuados. Aceptas cumplir las leyes aplicables y la información específica de manejo y seguridad del producto. Peptides Costa Rica se reserva el derecho de rechazar o cancelar pedidos cuando se sospeche uso humano o animal.',
  },
};

const STORAGE_KEY = 'pcr-age-verified';

export default function AgeGate({ lang = 'en' }) {
  const [open, setOpen] = useState(false);
  const [remember, setRemember] = useState(false);
  const copy = COPY[lang] || COPY.en;

  useEffect(() => {
    const accepted =
      window.localStorage.getItem(STORAGE_KEY) === 'yes' ||
      window.sessionStorage.getItem(STORAGE_KEY) === 'yes';
    setOpen(!accepted);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const accept = () => {
    const storage = remember ? window.localStorage : window.sessionStorage;
    storage.setItem(STORAGE_KEY, 'yes');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="age-gate-title"
        aria-modal="true"
        className="w-full max-w-[500px] rounded-[10px] bg-white px-6 py-7 text-center shadow-2xl sm:px-9"
        role="dialog"
      >
        <img
          alt="Peptides Costa Rica"
          className="mx-auto h-auto w-[250px] max-w-[75%]"
          height="148"
          src="/wp-content/uploads/2026/02/COSTA-RICA-1-e1771916272916.png"
          width="300"
        />
        <h2 className="mt-4 text-lg font-bold tracking-tight text-primary" id="age-gate-title">
          {copy.title}
        </h2>
        <p className="mx-auto mt-3 max-w-[390px] text-sm leading-5 text-black">{copy.intro}</p>
        <p className="mx-auto mt-4 max-w-[420px] text-sm leading-5 text-black">{copy.confirm}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <a
            className="rounded-md bg-[#dc2626] px-4 py-2 text-sm font-bold text-white"
            href="https://www.google.com/"
          >
            {copy.disagree}
          </a>
          <button
            className="cursor-pointer rounded-md bg-[#07840b] px-4 py-2 text-sm font-bold text-white"
            onClick={accept}
            type="button"
          >
            {copy.agree}
          </button>
        </div>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-1.5 text-xs text-primary">
          <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
          {copy.remember}
        </label>
        <p className="mt-5 text-[11px] leading-[21px] text-black">{copy.legal}</p>
      </section>
    </div>
  );
}
