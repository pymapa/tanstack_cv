import logo from '../../../../public/brand/kipina-logo.png?inline'
import type { CvDocument } from '~/cv/schema'
import type { CvRenderOptions } from '../render-html'
import { Entry, InlineList, Section, present } from './common'

type Props = Readonly<{ cv: CvDocument; options: CvRenderOptions }>

export function Cover({ cv, options }: Props) {
  const { basics } = cv
  const strengths = basics['x-strengths'] ?? []
  const keyRoles = basics['x-keyRoles'] ?? []
  const keySkills = basics['x-keySkills'] ?? []
  const keywords = basics['x-keywords'] ?? []
  const industries = basics['x-industries'] ?? []
  const testimonial = cv['x-testimonials']?.[0]

  return (
    <div className="page page--cover">
      <header className="band">
        <div className="band__top">
          <span className="logo-chip">
            <img src={logo} alt="Kipinä" />
          </span>
          <span className="band__eyebrow">Consultant CV</span>
        </div>
        <h1>{basics.name}</h1>
        <p className="band__label">{basics.label}</p>
        {basics['x-experienceSummary'] !== undefined && (
          <p className="band__summary">{basics['x-experienceSummary']}</p>
        )}
        {basics['x-tagline'] !== undefined && <p className="band__tagline serif">{basics['x-tagline']}</p>}
        {options.includeContact && <Contact cv={cv} />}
      </header>

      <div className="cover-body">
        {basics.summary.trim() !== '' && (
          <Section title="Profile">
            {basics.summary
              .split(/\n{2,}/)
              .filter((para) => para.trim() !== '')
              .map((para) => (
                <p key={para.slice(0, 40)} className="lede" style={{ marginTop: '2mm' }}>
                  {para}
                </p>
              ))}
          </Section>
        )}

        {strengths.length > 0 && (
          <Section title="In a nutshell">
            <ul className="strengths">
              {strengths.map((s) => (
                <li key={s.title}>
                  <h3>{s.title}</h3>
                  {s.description !== undefined && <p>{s.description}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(keyRoles.length > 0 || keySkills.length > 0) && (
          <div className="two-col">
            {keyRoles.length > 0 && <TitledList title="Key roles" items={keyRoles} />}
            {keySkills.length > 0 && <TitledList title="Key skills" items={keySkills} />}
          </div>
        )}

        {(keywords.length > 0 || industries.length > 0) && (
          <Section title="Expertise">
            <ul className="entries">
              {keywords.length > 0 && (
                <Entry aside="Focus areas">
                  <InlineList items={keywords} />
                </Entry>
              )}
              {industries.length > 0 && (
                <Entry aside="Industries">
                  <InlineList items={industries} />
                </Entry>
              )}
            </ul>
          </Section>
        )}

        {testimonial !== undefined && (
          <figure className="quote">
            <blockquote>
              <p className="serif">“{testimonial.quote}”</p>
            </blockquote>
            {testimonial.author !== undefined && <cite>{testimonial.author}</cite>}
          </figure>
        )}

        {basics['x-hobbies'] !== undefined && <p className="hobbies">Outside work: {basics['x-hobbies']}</p>}
      </div>
    </div>
  )
}

function TitledList({
  title,
  items,
}: {
  title: string
  items: ReadonlyArray<{ title: string; description?: string | undefined }>
}) {
  return (
    <Section title={title} className="section--minor">
      <ul className="item-list">
        {items.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            {item.description !== undefined && <span className="muted">{item.description}</span>}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** Contact details as plain text only: never links, so nothing in the PDF points to an external URL. */
function Contact({ cv }: { cv: CvDocument }) {
  const { basics } = cv
  const lines = present([
    basics.email,
    basics.phone,
    basics.url,
    ...(basics.profiles ?? []).map((p) => present([p.network, p.username ?? p.url]).join(': ')),
  ])
  if (lines.length === 0) return null
  return (
    <ul className="band__contact" aria-label="Contact details">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}
