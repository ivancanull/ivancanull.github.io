# Ph.D. Profile Update Design

## Goal

Update the published academic profile to reflect Huifan Zhang's completed Ph.D., link the doctoral advisor's faculty page, and simplify the Bauhaus background by removing the repeated vertical-line texture.

## Content Changes

- Replace `Ph.D. Candidate in Electronic Science and Technology` with `Ph.D. in Electronic Science and Technology` everywhere it is sourced from site or CV data.
- Set the doctoral education period to `2020 – 2026` and remove all expected-graduation wording.
- Represent the advisor as structured CV data with:
  - Name: `Prof. Pingqiang Zhou`
  - URL: `https://faculty.sist.shanghaitech.edu.cn/faculty/zhoupq/home.html`
- Render the advisor name as a descriptive external link in the CV, opening in a new tab with `noopener noreferrer` protection.

## Visual Change

- Remove the repeating vertical-line background from the page body.
- Retain the ivory background, charcoal rules, primary-color geometry, typography, spacing, and all other Bauhaus styling.
- Keep print output black on white; the screen-background change must not alter CV pagination.

## Data And Rendering

- Extend the centralized CV schema so an education entry may contain an optional structured advisor object with a required name and validated HTTPS URL.
- Keep the advisor information in `src/data/cv.yml`; do not hard-code the faculty link in the page component.
- Render no advisor row when the optional object is absent.

## Verification

- Add tests that fail on the old candidate/expected-graduation wording.
- Verify the completed degree and `2020 – 2026` period appear in generated Home and CV output.
- Verify the advisor link, accessible name, new-tab behavior, and secure relationship attributes.
- Verify the body no longer uses the repeated vertical-line gradient.
- Run the complete automated suite and browser verification to catch layout or print regressions.

## Out Of Scope

- No changes to research topics, publication data, contact details, navigation, page structure, or deployment configuration.
