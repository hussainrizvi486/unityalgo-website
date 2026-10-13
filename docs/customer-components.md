# Customer component library

Open `/dashboard/components` or choose **Components** in the customer sidebar. The page requires a customer login and renders the same components used by customer screens. Examples use sample data and do not create sites or change account settings.

## Change styling once

Edit `app/dashboard/portal.css` for portal colors, typography, borders, sizing and spacing. The rules are scoped to `.customer-portal`; they do not change the public website or admin theme.

```css
.customer-portal {
    --control-height: 32px;
    --control-font-size: 12px;
    --control-line-height: 16px;
    --control-radius: 6px;
    --control-padding-x: 12px;
    --label-gap: 6px;
    --radius: 10px;
    --panel-padding: 24px;
    --dens: 1;
}
```

Changing `--control-height` updates Input (including PasswordInput, SmartInput and Autocomplete), SelectTrigger and Button throughout the portal. Small buttons use height minus 4px, large buttons use height plus 8px, and icon buttons remain square. Textarea uses the same font and corner tokens with a multiline height. Labels use the same control font and a single spacing token.

Avoid setting local heights, label font sizes or primary button colors in each form. Use the shared component's variant or size prop. Position and layout classes such as `w-full`, `mt-4`, and `pl-8` remain page-specific.

## Change a component once

Edit the corresponding file in `components/ui` to change its behavior, markup, variants or accessibility. Those components are shared with other parts of the website, so use `portal.css` for portal-only visual changes. Each example on the library page has a **Source & usage** disclosure.

```tsx
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { PortalPanel } from '@/components/customer/portal-panel';

<PortalPanel>
    <FormField id="workspace" label="Workspace name">
        <Input id="workspace" name="workspace" />
    </FormField>
    <Button className="mt-4">Save changes</Button>
</PortalPanel>
```

`PortalPanel` is used by Profile, Security, Sessions, Sites, App Store and the library. Edit its CSS rule once to update those surfaces. `padding="none"` supports composed layouts such as the two-column Security panel.

Radix overlays receive the theme and font classes through `ThemeScope`. This covers Popover, Tooltip, Sheet, Select, Dialog and AlertDialog even when their content is portalled to the body.

The sizing playground demonstrates local token changes only. It does not persist a customer preference or change the global theme; edit the source tokens to apply a permanent change.

## Library coverage

- Foundations: colors, fonts, shared sizes, radius and density.
- Actions: button variants, small/default/large/icon sizes, disabled and pending states.
- Fields: input, label, password, textarea, Select, Autocomplete, SmartInput, OTP and FormField validation.
- Choices: checkbox, switch and native radio buttons.
- Surfaces: PortalPanel, semantic badges and Notice feedback.
- Navigation: breadcrumb, NavigationMenu, sidebar, tabs, accordion and separators.
- Data: Table, searchable sample rows and a single-page pagination state.
- Overlays: Dialog, AlertDialog, Sheet, Popover, Tooltip and DropdownMenu.
- Loading: Skeleton, progress and empty-state examples.
