import { graphql } from "@/graphql/generated";

/** Everything the page renders server-side: house rosters (with detail-panel fields and whether a portrait is registered) and the curated spells. */
export const PageDataQuery = graphql(`
  query PageData {
    houses {
      name
      displayName
      traits
      members {
        id
        name
        initials
        house
        alternateNames
        ancestry
        patronus
        actor
        dateOfBirth
        alive
        eyeColour
        hairColour
        wand {
          wood
          core
          lengthInches
        }
        portrait {
          src
        }
      }
    }
    spells {
      id
      name
      description
      colour
      effect
    }
  }
`);
