export function capitalize<T extends string>(value: T): Capitalize<T> {
	return <Capitalize<T>>(value.at(0).toUpperCase() + value.slice(1));
}

export function uncapitalize<T extends string>(value: T): Uncapitalize<T> {
	return <Uncapitalize<T>>(value.at(0).toLowerCase() + value.slice(1));
}
