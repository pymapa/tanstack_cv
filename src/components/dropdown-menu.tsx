import { Menu } from '@base-ui/react/menu'
import { ChevronDown } from 'lucide-react'

type WithClassName<P> = Omit<P, 'className'> & { className?: string }

export const DropdownMenu = Menu.Root

export function DropdownMenuTrigger({ className = '', children, ...props }: WithClassName<Menu.Trigger.Props>) {
  return (
    <Menu.Trigger
      className={`group inline-flex items-center gap-2 rounded-card border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
      <ChevronDown
        aria-hidden="true"
        className="size-4 text-muted transition-transform group-data-popup-open:rotate-180"
      />
    </Menu.Trigger>
  )
}

export function DropdownMenuContent({
  className = '',
  align = 'start',
  sideOffset = 4,
  ...props
}: WithClassName<Menu.Popup.Props> & Pick<Menu.Positioner.Props, 'align' | 'sideOffset'>) {
  return (
    <Menu.Portal>
      <Menu.Positioner align={align} sideOffset={sideOffset} className="z-50 outline-none">
        <Menu.Popup
          className={`min-w-[var(--anchor-width)] rounded-card border border-line bg-white py-1 text-sm text-ink shadow-[0_1px_2px_rgb(43_43_43/0.06)] outline-none ${className}`}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export function DropdownMenuItem({ className = '', ...props }: WithClassName<Menu.Item.Props>) {
  return (
    <Menu.Item
      className={`flex cursor-default items-center gap-2 px-3 py-2 outline-none select-none data-disabled:opacity-50 data-highlighted:bg-lime ${className}`}
      {...props}
    />
  )
}
