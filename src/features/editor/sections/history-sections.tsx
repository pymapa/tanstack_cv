import type { Certificate, Work } from '~/cv/schema'
import { DateField, TextArea, TextField } from '../fields'
import { ListSection } from '../list-section'

type Testimonial = { quote: string; author?: string }

export function WorkSection() {
  return (
    <ListSection<Work>
      title="Work history"
      path={['work']}
      noun="employer"
      newItem={() => ({ name: '' })}
      describe={(work) => work.name}
      renderItem={(_work, path) => (
        <div className="grid grid-cols-2 gap-3">
          <TextField path={[...path, 'name']} label="Employer" />
          <TextField path={[...path, 'position']} label="Position" />
          <DateField path={[...path, 'startDate']} label="Start" />
          <DateField path={[...path, 'endDate']} label="End" hint="Empty = current" />
          <TextArea path={[...path, 'summary']} label="Summary" rows={3} className="col-span-2" />
        </div>
      )}
    />
  )
}

export function CertificatesSection() {
  return (
    <ListSection<Certificate>
      title="Certificates"
      path={['certificates']}
      noun="certificate"
      newItem={() => ({ name: '' })}
      describe={(certificate) => certificate.name}
      renderItem={(_certificate, path) => (
        <div className="grid grid-cols-[1fr_1fr_9rem] gap-3">
          <TextField path={[...path, 'name']} label="Certificate" />
          <TextField path={[...path, 'issuer']} label="Issuer" />
          <DateField path={[...path, 'date']} label="Date" />
        </div>
      )}
    />
  )
}

export function TestimonialsSection() {
  return (
    <ListSection<Testimonial>
      title="Testimonials"
      path={['x-testimonials']}
      noun="testimonial"
      intro="Short quotes from clients or colleagues, with their permission."
      newItem={() => ({ quote: '' })}
      describe={(t) => t.quote.slice(0, 40)}
      renderItem={(_t, path) => (
        <div className="flex flex-col gap-3">
          <TextArea path={[...path, 'quote']} label="Quote" rows={3} />
          <TextField path={[...path, 'author']} label="Author" placeholder="Role, organisation" />
        </div>
      )}
    />
  )
}
