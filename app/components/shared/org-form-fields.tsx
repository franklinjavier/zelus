import type { FieldErrors } from '~/lib/forms'
import { Field, FieldLabel, FieldError } from '~/components/ui/field'
import { Input } from '~/components/ui/input'

export function OrgFormFields({ fieldErrors }: { fieldErrors?: FieldErrors | null }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="name">
          Nome do condomínio <span className="text-destructive">*</span>
        </FieldLabel>
        <Input id="name" name="name" placeholder="Ex: Edifício Aurora" required />
        {fieldErrors?.name && <FieldError>{fieldErrors.name}</FieldError>}
      </Field>

      <Field>
        <FieldLabel htmlFor="city">
          Cidade / localização <span className="text-destructive">*</span>
        </FieldLabel>
        <Input id="city" name="city" placeholder="Ex: Lisboa" required />
        {fieldErrors?.city && <FieldError>{fieldErrors.city}</FieldError>}
      </Field>

      <Field>
        <FieldLabel htmlFor="totalFractions">Número total de frações</FieldLabel>
        <Input id="totalFractions" name="totalFractions" type="number" placeholder="Ex: 12" />
      </Field>

      <Field>
        <FieldLabel htmlFor="notes">Notas internas</FieldLabel>
        <Input id="notes" name="notes" placeholder="Opcional" />
      </Field>
    </>
  )
}
