export function IntroDescription({ children }: { children: string }) {
  return (
    <p>
      {children
        .split('**')
        .map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part))}
    </p>
  )
}
