import Link from "next/link";
import { DEMO_BASE_PATH } from "@/lib/demos/clos-et-cadre/company";
import type { Project } from "@/lib/demos/clos-et-cadre/projects";
import { getService } from "@/lib/demos/clos-et-cadre/services";
import { Drawing } from "./Drawing";

export function ProjectCard({ project, priority = false }: { project: Project; priority?: boolean }) {
  const service = getService(project.service);
  return (
    <article className="group relative">
      <div className="overflow-hidden bg-[var(--cc-paper)]">
        <div className="transition-transform duration-700 ease-[var(--cc-ease)] group-hover:scale-[1.025]">
          <Drawing scene={project.scene} state="after" uid={`card-${project.slug}${priority ? "-p" : ""}`} titleBlock={false} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--cc-muted)]">
        <span className="cc-label text-[11.5px] text-[var(--cc-accent)]">{service.name}</span>
        <span aria-hidden="true">·</span>
        <span>{project.commune}</span>
      </div>
      <h3 className="cc-serif mt-2 text-[24px] leading-[1.15] sm:text-[26px]">
        <Link href={`${DEMO_BASE_PATH}/realisations/${project.slug}`} className="after:absolute after:inset-0">
          {project.shortTitle}
        </Link>
      </h3>
      <p className="mt-3 text-[15.5px] leading-relaxed text-[var(--cc-muted)]">{project.situation}</p>
      <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-[var(--cc-line)] pt-4 text-[13.5px]">
        <div>
          <dt className="text-[var(--cc-muted)]">Surface</dt>
          <dd className="mt-1">{project.facts.surface.split(" — ")[0]}</dd>
        </div>
        <div>
          <dt className="text-[var(--cc-muted)]">Durée</dt>
          <dd className="mt-1">{project.facts.duration.split(",")[0]}</dd>
        </div>
        <div>
          <dt className="text-[var(--cc-muted)]">Budget HT</dt>
          <dd className="mt-1">{project.facts.budget.replace(" € HT", " €")}</dd>
        </div>
      </dl>
    </article>
  );
}
