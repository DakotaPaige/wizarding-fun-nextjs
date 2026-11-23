import type { HouseName } from "@/data/types";

/** Featured character IDs (HP-API ids) per house, in display order. */
export const ROSTER: Readonly<Record<HouseName, readonly string[]>> = {
  GRYFFINDOR: [
    "9e3f7ce4-b9a7-4244-b709-dae5c1f1d4a8", // Harry Potter
    "4c7e6819-a91a-45b2-a454-f931e4a7cce3", // Hermione Granger
    "c3b1f9a5-b87b-48bf-b00d-95b093ea6390", // Ron Weasley
    "b415c867-1cff-455e-b194-748662ac2cca", // Albus Dumbledore
    "ca3827f0-375a-4891-aaa5-f5e8a5bad225", // Minerva McGonagall
    "3db6dc51-b461-4fa4-a6e4-b1ff352221c5", // Neville Longbottom
  ],
  SLYTHERIN: [
    "af95bd8a-dfae-45bb-bc69-533860d34129", // Draco Malfoy
    "3569d265-bd27-44d8-88e8-82fb0a848374", // Severus Snape
    "efa802c8-ae18-4ae1-a524-49df21d05939", // Lord Voldemort
    "6afb1960-febd-418d-b604-e50c1b59459b", // Bellatrix Lestrange
    "2fb675cd-5505-4c8e-a54e-579e73bf4174", // Horace Slughorn
    "43403619-70cb-4a0c-b70a-6d5cae20e602", // Lucius Malfoy
  ],
  RAVENCLAW: [
    "861c4cde-2f0f-4796-8d8f-9492e74b2573", // Luna Lovegood
    "8f9aa40b-5d7c-441e-ad32-4564ecda3b70", // Cho Chang
    "a61e0783-7914-4f8d-a800-c409c06315cf", // Filius Flitwick
    "69c18f6a-cd97-4218-9f2f-740393e6eb1f", // Padma Patil
    "9969f803-6835-4871-80b3-7bb975c1ec06", // Moaning Myrtle
    "d1e8ddf1-cfc7-404a-bffe-f4ac6c656ead", // Xenophilius Lovegood
  ],
  HUFFLEPUFF: [
    "d5c4daa3-c726-426a-aa98-fb40f3fba816", // Cedric Diggory
    "99370b33-d5a7-465b-91b1-55ef2a40182b", // Nymphadora Tonks
    "e8694719-a975-48fb-9523-f4cade1c38aa", // Pomona Sprout
    "2a376401-4821-4aec-94d7-9b3da2c77d85", // Newt Scamander
    "0af82694-e24f-45ec-a8d7-5bb1199ce631", // Hannah Abbott
    "0c80d701-fa23-4126-9711-efe5f3c4789a", // Ernie Macmillan
  ],
};
