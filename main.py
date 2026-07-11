import tkinter as tk


# 계산식이 보이는 입력창에 글자를 추가하는 함수입니다.
def add_text(text):
    current_text = display_entry.get()
    display_entry.delete(0, tk.END)
    display_entry.insert(0, current_text + text)


# C 버튼을 눌렀을 때 입력창을 모두 지우는 함수입니다.
def clear_display():
    display_entry.delete(0, tk.END)


# = 버튼을 눌렀을 때 계산하는 함수입니다.
def calculate_result():
    original_expression = display_entry.get()

    # 화면에는 곱하기를 ×, 나누기를 ÷로 보여주지만,
    # Python은 곱하기를 *, 나누기를 /로 계산합니다.
    expression = original_expression.replace("×", "*")
    expression = expression.replace("÷", "/")

    try:
        result = eval(expression)

        history_listbox.insert(tk.END, original_expression + " = " + str(result))
        history_listbox.see(tk.END)

        display_entry.delete(0, tk.END)
        display_entry.insert(0, str(result))

    except ZeroDivisionError:
        display_entry.delete(0, tk.END)
        display_entry.insert(0, "0으로 나눌 수 없습니다.")

    except Exception:
        display_entry.delete(0, tk.END)
        display_entry.insert(0, "잘못된 계산입니다.")


# 버튼을 쉽게 만들기 위한 함수입니다.
def create_button(text, row, column, command):
    button = tk.Button(
        button_frame,
        text=text,
        font=("Arial", 18),
        command=command
    )
    button.grid(row=row, column=column, padx=4, pady=4, sticky="nsew")


# 계산기 창을 만듭니다.
window = tk.Tk()
window.title("계산기")
window.geometry("380x620")
window.minsize(340, 540)

# 창 안의 내용이 창 크기에 맞춰 같이 커지도록 설정합니다.
window.columnconfigure(0, weight=1)
window.rowconfigure(2, weight=1)

# 계산 기록이 표시되는 영역입니다.
history_listbox = tk.Listbox(
    window,
    height=6,
    font=("Arial", 12)
)
history_listbox.grid(row=0, column=0, padx=12, pady=(12, 4), sticky="nsew")

# 숫자와 계산식이 표시되는 입력창입니다.
display_entry = tk.Entry(
    window,
    font=("Arial", 22),
    justify="right"
)
display_entry.grid(row=1, column=0, padx=12, pady=(4, 12), sticky="ew")

# 버튼들이 들어갈 영역입니다.
# 이 영역 안에서 버튼 4칸 x 4줄이 같은 크기로 나뉩니다.
button_frame = tk.Frame(window)
button_frame.grid(row=2, column=0, padx=8, pady=8, sticky="nsew")

for column in range(4):
    button_frame.columnconfigure(column, weight=1)

for row in range(4):
    button_frame.rowconfigure(row, weight=1)

# 첫 번째 줄 버튼입니다.
create_button("7", 0, 0, lambda: add_text("7"))
create_button("8", 0, 1, lambda: add_text("8"))
create_button("9", 0, 2, lambda: add_text("9"))
create_button("÷", 0, 3, lambda: add_text("÷"))

# 두 번째 줄 버튼입니다.
create_button("4", 1, 0, lambda: add_text("4"))
create_button("5", 1, 1, lambda: add_text("5"))
create_button("6", 1, 2, lambda: add_text("6"))
create_button("×", 1, 3, lambda: add_text("×"))

# 세 번째 줄 버튼입니다.
create_button("1", 2, 0, lambda: add_text("1"))
create_button("2", 2, 1, lambda: add_text("2"))
create_button("3", 2, 2, lambda: add_text("3"))
create_button("-", 2, 3, lambda: add_text("-"))

# 네 번째 줄 버튼입니다.
create_button("C", 3, 0, clear_display)
create_button("0", 3, 1, lambda: add_text("0"))
create_button("=", 3, 2, calculate_result)
create_button("+", 3, 3, lambda: add_text("+"))

# 창을 계속 실행합니다.
window.mainloop()
