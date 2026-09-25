import { CV_TEMPLATE_IDS, CvTemplateId } from '~/cv/schema'
import { CV_TEMPLATES } from '~/pdf/template/templates'

type Props = Readonly<{ value: CvTemplateId; onChange: (template: CvTemplateId) => void }>

export function TemplateSelect({ value, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Template
      <select
        value={value}
        onChange={(e) => {
          onChange(CvTemplateId.parse(e.target.value))
        }}
        className="max-w-72 rounded-card border border-line bg-white px-3 py-2.5 text-sm text-ink hover:border-ink"
        data-testid="cv-template"
      >
        {CV_TEMPLATE_IDS.map((id) => (
          <option key={id} value={id}>
            {CV_TEMPLATES[id].label}
          </option>
        ))}
      </select>
    </label>
  )
}
