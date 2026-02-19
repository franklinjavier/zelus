import { withMask } from 'use-mask-input'

import { Input } from '~/components/ui/input'

function PhoneInput(props: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  return (
    <Input
      {...props}
      type="tel"
      ref={withMask(['999 999 999', '+999 999 999 999'], {
        placeholder: '',
        showMaskOnHover: false,
        showMaskOnFocus: false,
      })}
    />
  )
}

export { PhoneInput }
