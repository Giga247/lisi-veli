# ტრანსკრიპტიდან (.jsonl) ამოიღებს მხოლოდ ადამიანურ დიალოგს:
# user-ის ტექსტს, assistant-ის ტექსტს და AskUserQuestion-ის პასუხებს.
# tool_use / tool_result / thinking / system-reminder / საიდჩეინები გაფილტრულია.

def strip_reminders:
  gsub("(?s)<system-reminder>.*?</system-reminder>"; "")
  | gsub("(?s)<local-command-stdout>.*?</local-command-stdout>"; "");

# ტექსტი ერთი შეტყობინებიდან: ჩვეულებრივი text ბლოკები +
# AskUserQuestion-ის tool_result (რომელშიც მიღებული გადაწყვეტილება ზის)
def blocktext:
  if type == "string" then .
  elif type == "array" then
    [ .[]
      | if .type == "text" then .text
        elif .type == "tool_result" then
          ( (.content | if type == "array" then
                          [ .[] | select(.type == "text") | .text ] | join("\n")
                        elif type == "string" then . else "" end)
            | select(test("questions have been answered")) )
        else empty end
    ] | join("\n")
  else "" end;

select(.type == "user" or .type == "assistant")
| select(.isSidechain != true)
| select(.isMeta != true)
| { role: .type, text: (.message.content | blocktext | strip_reminders) }
| select(.text | test("[^[:space:]]"))
| if .role == "user" then "### 👤 მომხმარებელი\n" + .text
  else "### 🤖 Claude\n" + .text end
