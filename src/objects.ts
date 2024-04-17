export const filterObject = (object: object, ...keys: string[]) => Object.fromEntries(Object.entries(object).filter(([key]) => keys.includes(key)));
