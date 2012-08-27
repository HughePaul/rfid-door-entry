
;**********************************************************************
;                                                                     *
;    Filename:	    main.asm                                          *
;    Date:          29/07/2012                                        *
;    File Version:  v1.0                                              *
;                                                                     *
;    Author:        Paul Winkler                                      *
;    Company:       HughePaul                                         *
;                                                                     * 
;                                                                     *
;**********************************************************************
;                                                                     *
;    Files Required: P16F627.INC                                      *
;                                                                     *
;**********************************************************************
;                                                                     *
;    Notes:                                                           *
;                                                                     *
;**********************************************************************


	list      p=16f627            ; list directive to define processor
	#include <p16f627.inc>        ; processor specific variable definitions
	
	__CONFIG _CP_OFF & _WDT_ON & _BODEN_ON & _PWRTE_ON & _XT_OSC & _MCLRE_OFF & _LVP_OFF

; '__CONFIG' directive is used to embed configuration data within .asm file.
; The lables following the directive are located in the respective .inc file.
; See respective data sheet for additional information on configuration word.





;***** VARIABLE DEFINITIONS
w_temp        EQU     0x70        ; variable used for context saving 
status_temp   EQU     0x71        ; variable used for context saving
fsr_temp      EQU     0x72        ; variable used for context saving

serial_in_write	EQU		0x74

serial_in00	EQU		0xA0
serial_in01	EQU		0xA1
serial_in02	EQU		0xA2
serial_in03	EQU		0xA3
serial_in04	EQU		0xA4
serial_in05	EQU		0xA5
serial_in06	EQU		0xA6
serial_in07	EQU		0xA7
serial_in08	EQU		0xA8
serial_in09	EQU		0xA9
serial_in0A	EQU		0xAA
serial_in0B	EQU		0xAB
serial_in0C	EQU		0xAC
serial_in0D	EQU		0xAD
serial_in0E	EQU		0xAE
serial_in0F	EQU		0xAF
serial_in10	EQU		0xB0
serial_in11	EQU		0xB1
serial_in12	EQU		0xB2
serial_in13	EQU		0xB3
serial_in14	EQU		0xB4
serial_in15	EQU		0xB5
serial_in16	EQU		0xB6
serial_in17	EQU		0xB7
serial_in18	EQU		0xB8
serial_in19	EQU		0xB9
serial_in1A	EQU		0xBA
serial_in1B	EQU		0xBB
serial_in1C	EQU		0xBC
serial_in1D	EQU		0xBD
serial_in1E	EQU		0xBE
serial_in1F	EQU		0xBF

serial_out_read		EQU		0x75
serial_out_write	EQU		0x76
serial_buffer	EQU		0x77

serial_out00	EQU		0xC0
serial_out2F	EQU		0xEF

rfid_pos	EQU		0x28

rfid_len	EQU		0x29
rfid_cmd	EQU		0x2A
rfid_status	EQU		0x2B
rfid_byte0	EQU		0x2C
rfid_byte1	EQU		0x2D
rfid_byte2	EQU		0x2E
rfid_byte3	EQU		0x2F
rfid_byte4	EQU		0x30
rfid_byte5	EQU		0x31
rfid_byte6	EQU		0x32
rfid_byte7	EQU		0x33
rfid_byte8	EQU		0x34
rfid_byte9	EQU		0x35
rfid_byteA	EQU		0x36
rfid_byteB	EQU		0x37
rfid_byteC	EQU		0x38
rfid_byteD	EQU		0x39

mem_lo		EQU		0x3A
mem_hi		EQU		0x3B
mem_pos		EQU		0x3C

mem_read0	EQU		0x3D
mem_read1	EQU		0x3E
mem_read2	EQU		0x3F
mem_read3	EQU		0x40
mem_read4	EQU		0x41
mem_read5	EQU		0x42
mem_read6	EQU		0x43
mem_read7	EQU		0x44

mem_write0	EQU		0x45
mem_write1	EQU		0x46
mem_write2	EQU		0x47
mem_write3	EQU		0x48
mem_write4	EQU		0x49
mem_write5	EQU		0x4A
mem_write6	EQU		0x4B
mem_write7	EQU		0x4C

mem_match0	EQU		0x4D
mem_match1	EQU		0x4E
mem_match2	EQU		0x4F
mem_match3	EQU		0x50
mem_match4	EQU		0x51
mem_match5	EQU		0x52
mem_match6	EQU		0x53
mem_match7	EQU		0x54

mem_command	EQU		0x55

hex_write_buffer	EQU		0x56

card_state		EQU		0x78
security_level	EQU		0x79
timer_counter	EQU		0x7A
programming_mode	EQU		0x7B
print_memory	EQU		0x7C

debug_reg	EQU		0x7F


OUT_GOOD	EQU	0
OUT_BAD		EQU	1
OUT_ERROR	EQU	2
OUT_DOOR	EQU	3

ADDR_RFID_W	EQU	b'10100000'
ADDR_RFID_R	EQU	b'10100001'

ADDR_MEM_W	EQU	b'10100110'
ADDR_MEM_R	EQU	b'10100111'


;**********************************************************************
		ORG     0x000             ; processor reset vector
		goto    main              ; go to beginning of program


		ORG     0x004             ; interrupt vector location
		movwf   w_temp            ; save off current W register contents
		movf	STATUS,w          ; move status register into W register
		movwf	status_temp       ; save off contents of STATUS register
		movfw	FSR
		movwf	fsr_temp

; Serial port handling code
	banksel	PIR1

	; check for serial errors
	btfss	RCSTA, FERR
		goto int_no_serial_frame_error
	bcf		RCSTA, CREN
	bsf		RCSTA, CREN
	goto int_serial_in
int_no_serial_frame_error:

	btfss	RCSTA, OERR
		goto int_no_serial_overrun_error
	bcf		RCSTA, CREN
	bsf		RCSTA, CREN
int_no_serial_overrun_error:

int_serial_in:
	; check if there is any byte to read
	btfss	PIR1, RCIF
		goto int_no_serial_in
	banksel	RCSTA
	; read byte
	movfw	serial_in_write
	addlw	serial_in00
	movwf	FSR

	; inc serial pointer
	incf	serial_in_write, w
	andlw	0x1F
	movwf	serial_in_write

	banksel RCREG
	movfw	RCREG
	movwf	INDF

	; if 0x0A or 0x0D then send for processing
	addlw	-d'10'
	btfsc	STATUS, Z
		call serial_process	
	addlw	-d'3'
	btfsc	STATUS, Z
		call serial_process	
int_no_serial_in:

int_serial_out:
	; check if we can send
	banksel	PIR1
	btfss	PIR1, TXIF
		goto int_no_serial_out
	; check if there are any bytes to send
	movfw	serial_out_read
	subwf	serial_out_write, w
	btfss	STATUS, Z
		goto int_serial_out_send
	; if not then disable send interupt and skip sending
	banksel	PIE1
	bcf		PIE1, TXIE
	goto int_no_serial_out
int_serial_out_send:
	; send byte
	movfw	serial_out_read
	addlw	serial_out00
	movwf	FSR
	movfw	INDF
	banksel TXREG
	movwf	TXREG
	; inc serial out pos and check it is within range
	incf	serial_out_read, f
	movfw	serial_out_read
	btfss	serial_out_read, 5
		andlw	0x1F
	btfsc	serial_out_read, 5
		andlw	0x2F
	movwf	serial_out_read

int_no_serial_out:

int_timer:
; check timer1 overflow
	banksel	PIR1
	btfss	PIR1, TMR1IF
		goto int_no_timer
	; update timer registers
	call update_timer
	; increment timer
	incf	timer_counter, f

int_timer_flash:
	btfss	programming_mode, 0
		goto int_timer_no_flash
	btfsc	timer_counter, 0
		goto int_timer_flash_on
	bcf		PORTA, OUT_ERROR
	goto int_timer_no_flash
int_timer_flash_on:
	bsf		PORTA, OUT_ERROR

int_timer_no_flash:

int_timer_leds:
	; turn off lights when it reaches 4 ( 2 seconds )
	movfw	timer_counter
	addlw	-D'6'
	btfss	STATUS, Z
		goto int_no_timer_leds
	clrf		PORTA
int_no_timer_leds:

int_timer_programming:
	; turn off programming mode when it reaches 8 ( 4 seconds )
	movfw	timer_counter
	addlw	-D'12'
	btfss	STATUS, Z
		goto	int_no_timer_programming

	; turn programming mode off
	clrf	PORTA
	clrf	programming_mode

	call unset_timer

int_no_timer_programming:

int_no_timer:

		movfw	fsr_temp
		movwf	FSR
		movf    status_temp,w     ; retrieve copy of STATUS register
		movwf	STATUS            ; restore pre-isr STATUS register contents
		swapf   w_temp,f
		swapf   w_temp,w          ; restore pre-isr W register contents
		retfie                    ; return from interrupt

; lookup tables

hex_lookup:
	andlw	0x0f
	addwf	PCL, f
	retlw	'0'
	retlw	'1'
	retlw	'2'
	retlw	'3'
	retlw	'4'
	retlw	'5'
	retlw	'6'
	retlw	'7'
	retlw	'8'
	retlw	'9'
	retlw	'A'
	retlw	'B'
	retlw	'C'
	retlw	'D'
	retlw	'E'
	retlw	'F'


indf_dec_lookup:
	movfw	INDF
	call dec_lookup
	movwf	serial_buffer
	swapf	serial_buffer, f
	incf	FSR, f
	movfw	INDF
	call dec_lookup
	iorwf	serial_buffer, w
	incf	FSR, f
	return	

dec_lookup:
	; if < '0' return 0
	addlw	-'0'
	btfss	STATUS, C
	retlw	0x0

	; else if <= '9' ( < ':' )
	addlw	+'0'-':'
	btfss	STATUS, C
	goto dec_lookup_0to9

	; else if < 'A' return 0
	addlw	+':'-'A'
	btfss	STATUS, C
	retlw	0x0

	; else if <= 'F' ( < 'G' )
	addlw	+'A'-'G'
	btfss	STATUS, C
	goto dec_lookup_AtoF

	; else ( if > 'F' ) return 0
	retlw	0x0

dec_lookup_0to9:
	addlw	+':'-'0'+0x00
	return
dec_lookup_AtoF:
	addlw	+'G'-'A'+0x0A
	return

set_timer:
	clrf	timer_counter
	banksel	PIE1
	bsf		PIE1, TMR1IE
update_timer:
	banksel	TMR1L
	clrf	TMR1L
	movlw	D'12'
	movwf	TMR1H
	bcf		PIR1, TMR1IF
	return
unset_timer:
	banksel	PIE1
	bcf		PIE1, TMR1IE
	banksel	PORTA
	clrf	PORTA
	return


serial_process:
	; add a null
	movlw	serial_in_write
	movwf	FSR
	clrf	INDF

	; clear pointer
	clrf	serial_in_write

	; ignore empty lines
	banksel	serial_in00
	movfw	serial_in00
	addlw	-D'10'
	btfsc	STATUS, Z
		return
	addlw	D'10'-D'13'
	btfsc	STATUS, Z
		return

	; if ADD then add this id at this level
	addlw	D'13'-'A'
	btfsc	STATUS, Z
		goto serial_process_add

	; if REM then remove this id at this level
	addlw	'A'-'R'
	btfsc	STATUS, Z
		goto serial_process_rem

	; if PRINT then print all entries
	addlw	'R'-'P'
	btfsc	STATUS, Z
		goto serial_process_print

	; if REM then remove this id at this level
	addlw	'P'-'S'
	btfsc	STATUS, Z
		goto serial_process_sec

	; if OPEN then open the door
	addlw	'S'-'O'
	btfsc	STATUS, Z
		goto serial_process_open

serial_process_KO:
	clrf	STATUS
	; serial_process_ko
	call serial_start
	call serial_end
	movlw	'?'
	goto serial_write_end


serial_process_add:
	clrf	STATUS

	movlw	serial_in02
	movwf	FSR

	call indf_dec_lookup
	movwf	mem_write0
	call indf_dec_lookup
	movwf	mem_write1
	call indf_dec_lookup
	movwf	mem_write2
	call indf_dec_lookup
	movwf	mem_write3
	call indf_dec_lookup
	movwf	mem_write4
	call indf_dec_lookup
	movwf	mem_write5
	call indf_dec_lookup
	movwf	mem_write6
	call indf_dec_lookup
	movwf	mem_write7

	goto	data_add_direct

serial_process_rem:
	clrf	STATUS

	clrf	STATUS
	movlw	serial_in02
	movwf	FSR

	call indf_dec_lookup
	movwf	mem_match0
	call indf_dec_lookup
	movwf	mem_match1
	call indf_dec_lookup
	movwf	mem_match2
	call indf_dec_lookup
	movwf	mem_match3
	call indf_dec_lookup
	movwf	mem_match4
	call indf_dec_lookup
	movwf	mem_match5
	call indf_dec_lookup
	movwf	mem_match6
	call indf_dec_lookup
	andlw	0x0f
	movwf	mem_match7

	goto	data_remove_direct

serial_process_sec:
	; if SEC then set security level
	movfw	serial_in01
	sublw	' ' ; check for space
	btfss	STATUS, Z
		goto serial_process_sec_print

	; check for operand
	movfw	serial_in02
	clrf	STATUS
	call dec_lookup
	; if zero or not recognised then just print
	andlw	0xFF
	btfsc	STATUS, Z
		goto serial_process_sec_print

	movwf	security_level
	swapf	security_level, f

	; save security level to memory (eeprom write)


serial_process_sec_print:
	clrf	STATUS
	; print out current security level
	call serial_start
	call serial_end
	movlw	'S'
	call serial_write
	movlw	' '
	call serial_write
	swapf	security_level, w
	call hex_lookup
	goto serial_write_end

serial_process_print:
	incf	print_memory, f
	return
		
serial_process_open:
	clrf	STATUS
	call	unset_timer
	; turn on good access light
	clrf	STATUS
	bsf		PORTA, OUT_GOOD
	; open the door
	bsf		PORTA, OUT_DOOR
	call	set_timer

	call serial_start
	call serial_end
	movlw	'O'
	goto serial_write_end



main:
; set up io
	clrf	STATUS
	clrf	PORTA
	clrf	PORTB
	banksel	TRISA
	movlw	b'11110000'
	movwf	TRISA
	banksel	TRISB
	movlw	b'10111011'
	movwf	TRISB

; set up periferals
	banksel	OPTION_REG
	movlw	b'11111111'
	movwf	OPTION_REG
	banksel	INTCON
	movlw	b'11000000'
	movwf	INTCON
	banksel	PIE1
	movlw	b'0000001'
	movwf	PIE1
	banksel	T1CON
	movlw	b'00110101'
	movwf	T1CON
	banksel	T2CON
	movlw	b'01111011'
	movwf	T2CON
	banksel	CMCON
	movlw	b'00000111'
	movwf	CMCON
	banksel	VRCON
	movlw	b'00000000'
	movwf	VRCON
	banksel	CCP1CON
	movlw	b'00000000'
	movwf	CCP1CON
	
; set up serial port

	banksel	SPBRG
	movlw	D'25'
	movwf	SPBRG
	banksel	RCSTA
	movlw	b'10010000'
	movwf	RCSTA
	banksel	TXSTA
	movlw	b'00100110'
	movwf	TXSTA

	movlw	0xE0
	movwf	security_level
	clrf	programming_mode
	clrf	print_memory

	; read in saved security level (from eeprom)


; init varibles

	clrf	STATUS

	clrf	serial_in_write
	clrf	serial_out_read
	clrf	serial_out_write

	clrf	card_state;


	; test leds
	bsf		PORTA, OUT_GOOD
	bsf		PORTA, OUT_BAD
	bsf		PORTA, OUT_ERROR

	; let serial port settle
test_loop:
	clrwdt
	decfsz	card_state, f
		goto test_loop

	; clear leds
	clrf	PORTA

	; serial_process_reset
	call serial_start
	call serial_end
	movlw	'@'
	call serial_write_end



main_no_card:
	bcf		card_state, 0
main_loop:
	clrwdt

	; enable interupts
	banksel	PIE1
	bsf		PIE1, RCIE

	; if the print memory flag has been set then do that
	movfw	print_memory
	btfss	STATUS, Z
		call main_print_memory

	; check proximity flag falling edge
	banksel	PORTB
	btfsc	PORTB, 5
		goto main_no_card

	; test if a card has been newly presented
	btfss	card_state, 0
		call read_card

	goto main_loop

main_print_memory:
	; disable serial receive
	banksel	PIE1
	bcf		PIE1, RCIE

	clrf	STATUS
	clrf	print_memory

	call serial_start
	call serial_end

	; print each item as they are read
	movlw	0xFF
	movwf	mem_match7
	call mem_read

	; print a final P line to signify then end of data
	call serial_start
	movlw	'P'
	goto serial_write_end


read_card:
	call unset_timer

	bsf		card_state, 0

	; turn off serial receive interupt
	banksel	PIE1
	bcf		PIE1, RCIE

	; clear data
	banksel	rfid_len
	clrf	rfid_len
	clrf	rfid_cmd
	clrf	rfid_status
	clrf	rfid_byte0
	clrf	rfid_byte1
	clrf	rfid_byte2
	clrf	rfid_byte3
	clrf	rfid_byte4
	clrf	rfid_byte5
	clrf	rfid_byte6
	clrf	rfid_byte7

	; send read command to rfid reader
rfid_write:
	call I2c_start
	movlw	ADDR_RFID_W ; address write
	call I2c_send
	btfss	STATUS, Z
		goto rfid_fail_1
	movlw	D'1'	; length = 1
	call I2c_send
	btfss	STATUS, Z
		goto rfid_fail_1
	movlw	0x01	; command = 0x01
	call I2c_send
	btfss	STATUS, Z
		goto rfid_fail_1
	call I2c_stop

	; read result from rfid reader
rfid_read:
	movlw	D'10'
	call I2c_pause
	call I2c_start
	movlw	ADDR_RFID_R ; address read
	call I2c_send
	btfsc	STATUS, Z
		goto rfid_read_continue

	call I2c_stop
	goto rfid_read ; retry

rfid_read_continue:
	call I2c_recv
	movwf	rfid_len

	; check if we have any length
	btfsc	STATUS, Z
		goto rfid_fail_2

	clrf	rfid_pos
rfid_read_loop:
	call I2c_ack

	; set mem location
	movfw	rfid_pos
	andlw	0x0f	; sanity
	addlw	rfid_cmd
	movwf	FSR
	incf	rfid_pos, f

	; read byte
	call I2c_recv
	movwf	INDF
	
	decfsz	rfid_len, f
		goto rfid_read_loop

rfid_read_no_len:
	call I2c_noack
	call I2c_stop

	clrf	STATUS

	; check command and status
	movfw	rfid_cmd
	addlw	-D'1'
	btfss	STATUS, Z
		goto rfid_fail_3
	movfw	rfid_status
	btfss	STATUS, Z
		goto rfid_fail


	; copy bytes
	movfw	rfid_byte0
	movwf	mem_match0
	movfw	rfid_byte1
	movwf	mem_match1
	movfw	rfid_byte2
	movwf	mem_match2
	movfw	rfid_byte3
	movwf	mem_match3
	movfw	rfid_byte4
	movwf	mem_match4
	movfw	rfid_byte5
	movwf	mem_match5
	movfw	rfid_byte6
	movwf	mem_match6
	movfw	rfid_byte7
	andlw	0x0F
	movwf	mem_match7
	call mem_read

	andlw	0xFF	; return 0 found
	btfsc	STATUS, Z
		goto rfid_found

	addlw	-D'2'	; return 2 is end of data, ie not found
	btfsc	STATUS, Z
		goto rfid_not_found

	; a memory error occured
	movlw	0x01
	goto rfid_fail_4


rfid_found:
	; check security level
	movfw	mem_read7
	andlw	0xF0
	movwf	mem_match7 ; temp space
	movfw	security_level
	subwf	mem_match7, w
	btfss	STATUS, C
		goto rfid_noperm

	; check if we should be turning programming mode on
	movfw	mem_read7
	andlw	0xF0
	xorlw	0xF0
	btfsc	STATUS, Z
		goto enable_programming

	; if already in programming mode then remove the card
	btfss	programming_mode, 0
		goto data_win
	goto data_remove

rfid_noperm:
	; if already in programming mode then remove the card
	btfss	programming_mode, 0
		goto data_noperm
	goto data_remove

enable_programming:
	bsf		programming_mode, 0
	goto data_win


rfid_not_found:
	; if in programming mode then add this item at current security level
	btfss	programming_mode, 0
		goto data_fail
	goto data_add



data_win:
	; turn on good access light
	clrf	STATUS
	bsf		PORTA, OUT_GOOD
	; open the door
	bsf		PORTA, OUT_DOOR
	call	set_timer

	call serial_start
	call serial_end
	movlw	'G'
	call serial_write_space
	goto serial_write_read


data_noperm:
	; turn on good and bad access light
	clrf	STATUS
	bsf		PORTA, OUT_GOOD
	bsf		PORTA, OUT_BAD
	call	set_timer

	call serial_start
	call serial_end
	movlw	'N'
	call serial_write_space
	goto serial_write_read


	; if not found and in programming mode add to database
data_add:
	clrf	programming_mode
	clrf	STATUS

	; copy bytes
	movfw	rfid_byte0
	movwf	mem_write0
	movfw	rfid_byte1
	movwf	mem_write1
	movfw	rfid_byte2
	movwf	mem_write2
	movfw	rfid_byte3
	movwf	mem_write3
	movfw	rfid_byte4
	movwf	mem_write4
	movfw	rfid_byte5
	movwf	mem_write5
	movfw	rfid_byte6
	movwf	mem_write6
	movfw	rfid_byte7
	andlw	0x0F
	iorwf	security_level, w
	movwf	mem_write7

data_add_direct:
	clrf	STATUS

	; find next available spot
	; set comparison to zero to look for deleted slots
	clrf	mem_match0
	clrf	mem_match1
	clrf	mem_match2
	clrf	mem_match3
	clrf	mem_match4
	clrf	mem_match5
	clrf	mem_match6
	clrf	mem_match7

	call	mem_read

	andlw	0xFF	; return 0 is deleted slot found
	btfsc	STATUS, Z
		goto data_add_write
	addlw	-D'2'	; return 2 is end of data
	btfsc	STATUS, Z
		goto data_add_write

	; a memory error occured
	movlw	0x02
	goto rfid_fail_4

data_add_write:

	call	mem_write
	andlw	0xFF
	btfss	STATUS, Z
		goto rfid_fail_4 ; a memory error occured

	; turn on both lights
	bsf		PORTA, OUT_GOOD
	bsf		PORTA, OUT_ERROR
	call	set_timer

	call serial_start
	call serial_end
	movlw	'A'
	call serial_write_space
	goto serial_write_write


data_remove_direct:
	clrf	STATUS

	call mem_read

	andlw	0xFF	; return 0 found
	btfsc	STATUS, Z
		goto data_remove

	addlw	-D'2'	; return 2 is end of data, ie not found
	btfsc	STATUS, Z
		goto rfid_fail_5

	; a memory error occured
	movlw	0x03
	goto rfid_fail_4

data_remove:
	clrf	programming_mode
	clrf	STATUS

	; find next available spot
	; set comparison to zero to look for deleted slots
	clrf	mem_write0
	clrf	mem_write1
	clrf	mem_write2
	clrf	mem_write3
	clrf	mem_write4
	clrf	mem_write5
	clrf	mem_write6
	clrf	mem_write7

	call	mem_write
	andlw	0xFF
	btfss	STATUS, Z
		goto rfid_fail_40 ; a memory error occured

	; turn on both lights
	bsf		PORTA, OUT_BAD
	bsf		PORTA, OUT_ERROR
	call	set_timer

	call serial_start
	call serial_end
	movlw	'R'
	call serial_write_space
	goto serial_write_read



	; if not found
data_fail:
	; turn on bad access light
	clrf	STATUS
	bsf		PORTA, OUT_BAD
	call	set_timer

	call serial_start
	call serial_end
	movlw	'B'
	call serial_write_space
	goto serial_write_match



	; if error
rfid_fail_1:
	movlw	0x10 ; no ack from command write
	movwf	rfid_status
	goto rfid_fail
rfid_fail_2:
	movlw	0x20 ; no reply length
	movwf	rfid_status
	goto rfid_fail
rfid_fail_3:
	movlw	0x30 ; incorrect reply command
	movwf	rfid_status
	goto rfid_fail
rfid_fail_40:
	clrw
rfid_fail_4:
	andlw	0x0F
	iorlw	0x40 ; database error
	movwf	rfid_status
	goto rfid_fail
rfid_fail_5:
	movlw	0x50 ; not found
	movwf	rfid_status
rfid_fail:
	clrf	STATUS
	; turn on error light
	bsf		PORTA, OUT_ERROR
	call	set_timer

	call serial_start
	call serial_end
	movlw	'!'
	call serial_write_space
	movfw	rfid_status
	call serial_write_hex
	goto serial_end




serial_write_match:
	call serial_start

	movfw	mem_match0
	call serial_write_hex
	movfw	mem_match1
	call serial_write_hex
	movfw	mem_match2
	call serial_write_hex
	movfw	mem_match3
	call serial_write_hex
	movfw	mem_match4
	call serial_write_hex
	movfw	mem_match5
	call serial_write_hex
	movfw	mem_match6
	call serial_write_hex
	movfw	mem_match7
	call serial_write_hex

	goto serial_end

serial_write_read:
	call serial_start

	movfw	mem_read0
	call serial_write_hex
	movfw	mem_read1
	call serial_write_hex
	movfw	mem_read2
	call serial_write_hex
	movfw	mem_read3
	call serial_write_hex
	movfw	mem_read4
	call serial_write_hex
	movfw	mem_read5
	call serial_write_hex
	movfw	mem_read6
	call serial_write_hex
	movfw	mem_read7
	call serial_write_hex

	goto serial_end

serial_write_write:
	call serial_start

	movfw	mem_write0
	call serial_write_hex
	movfw	mem_write1
	call serial_write_hex
	movfw	mem_write2
	call serial_write_hex
	movfw	mem_write3
	call serial_write_hex
	movfw	mem_write4
	call serial_write_hex
	movfw	mem_write5
	call serial_write_hex
	movfw	mem_write6
	call serial_write_hex
	movfw	mem_write7
	call serial_write_hex

	goto serial_end


serial_start:
; check if we should reset the output pointer
	movfw	serial_out_read
	subwf	serial_out_write, w
	btfss	STATUS, Z
		goto serial_start_write_no_clear
	clrf	serial_out_read
	clrf	serial_out_write
serial_start_write_no_clear:

	movfw	serial_out_write
	addlw	serial_out00
	movwf	FSR
	return


serial_write_space:
	call serial_write
	movlw	' '
serial_write:
	movwf	INDF
	; inc serial out pos and check it is within range
	incf	serial_out_write, f
	movfw	serial_out_write
	btfss	serial_out_write, 6
		andlw	0x1F
	btfsc	serial_out_write, 6
		andlw	0x2F
	movwf	serial_out_write
	addlw	serial_out00
	movwf	FSR

	banksel	PIE1
	bsf		PIE1, TXIE
	clrf	STATUS
	return

serial_write_hex:
	movwf	hex_write_buffer
	swapf	hex_write_buffer, w
	call hex_lookup
	call serial_write
	movfw	hex_write_buffer
	call hex_lookup
	goto serial_write

serial_write_end:
	call serial_write
serial_end:
	movlw	0x0D
	call serial_write
	movlw	0x0A
	goto serial_write
	





mem_read:
	; reset position
	clrf	mem_hi
	clrf	mem_lo

mem_read_bank:
	call I2c_start
	movlw	ADDR_MEM_W
	btfsc	mem_hi, 7	; test which bank we are addressing
		iorlw	b'00001000'
	call I2c_send
	btfss	STATUS, Z
		goto mem_fail
	movfw	mem_hi
	andlw	0x7F ; sanity align
	call I2c_send
	btfss	STATUS, Z
		goto mem_fail
	movfw	mem_lo
	andlw	0xF8 ; sanity align
	call I2c_send
	btfss	STATUS, Z
		goto mem_fail

	; start read
	call I2c_start
	movlw	ADDR_MEM_R
	call I2c_send
	btfss	STATUS, Z
		goto mem_fail

mem_read_record:
	clrwdt

	; start read of 8 bytes
	movlw	D'8'
	movwf	mem_pos
	movlw	mem_read0
	movwf	FSR
mem_read_byte:
	call I2c_recv
	movwf	INDF
	incf	FSR, f
	decfsz	mem_pos, f
		goto mem_read_next_byte

mem_read_end_check:
	; check if last byte was 0xFF

	incfsz	mem_read7, w
		goto mem_read_check_or_print

	;we have reached the end of the data
	call I2c_noack
	call I2c_stop
	retlw 0x02

mem_read_next_byte:
	call I2c_ack
	goto mem_read_byte

mem_read_check_or_print:
	; check if we should match or print
	incf	mem_match7, w
	btfss	STATUS, Z
		goto mem_read_check

	; check it is not an empty slot
	movfw	mem_read0
	iorwf	mem_read1, w
	iorwf	mem_read2, w
	iorwf	mem_read3, w
	iorwf	mem_read4, w
	iorwf	mem_read5, w
	iorwf	mem_read6, w
	iorwf	mem_read7, w
	btfsc	STATUS, Z
		goto mem_read_no_match

	; wait for serial out buffer to be cleared
mem_print_out_wait:
	movfw	serial_out_read
	subwf	serial_out_write, w
	btfss	STATUS, Z
		goto mem_print_out_wait

	call serial_start
	movlw	'P'
	call serial_write_space
	call serial_write_read

	goto mem_read_no_match


mem_read_check:
	; check each digit against rfid data
	movfw	mem_read0
	subwf	mem_match0, w
	btfss	STATUS, Z
		goto mem_read_no_match
	movfw	mem_read1
	subwf	mem_match1, w
	btfss	STATUS, Z
		goto mem_read_no_match
	movfw	mem_read2
	subwf	mem_match2, w
	btfss	STATUS, Z
		goto mem_read_no_match
	movfw	mem_read3
	subwf	mem_match3, w
	btfss	STATUS, Z
		goto mem_read_no_match
	movfw	mem_read4
	subwf	mem_match4, w
	btfss	STATUS, Z
		goto mem_read_no_match
	movfw	mem_read5
	subwf	mem_match5, w
	btfss	STATUS, Z
		goto mem_read_no_match
	movfw	mem_read6
	subwf	mem_match6, w
	btfss	STATUS, Z
		goto mem_read_no_match
	movfw	mem_read7
	andlw	0x0f ; mask out security level bits for comparison
	subwf	mem_match7, w
	btfss	STATUS, Z
		goto mem_read_no_match

	; we have found a correct match
	call I2c_noack
	call I2c_stop
	retlw 0x00

mem_read_no_match:
	; increment database pointer by 8
	movlw	D'8'
	addwf	mem_lo, f
	btfss	STATUS, Z
		goto mem_read_next_record ; no need to check bank, as hi hasn't rolled over
	incf	mem_hi, f

	; check if we have rolled over to the next bank
	movfw	mem_hi
	andlw	b'01111111'
	btfss	STATUS, Z
		goto mem_read_next_record
	call I2c_noack
	call I2c_stop
	goto mem_read_bank ; resend the bank address command

mem_read_next_record:
	call I2c_ack
	goto mem_read_record ; continuous read



mem_write:
	clrf	STATUS

	; set position
	call I2c_start
	movlw	ADDR_MEM_W
	btfsc	mem_hi, 7	; test which bank we are addressing
		iorlw	b'00001000'
	movwf	mem_command
	call I2c_send
	btfss	STATUS, Z
		goto mem_fail

	movfw	mem_hi
	andlw	0x7F ; sanity align
	call I2c_send
	btfss	STATUS, Z
		goto mem_fail
	movfw	mem_lo
	andlw	0xF8 ; sanity align
	call I2c_send
	btfss	STATUS, Z
		goto mem_fail

mem_write_record:
	; start write of 8 bytes
	movlw	D'8'
	movwf	mem_pos
	movlw	mem_write0
	movwf	FSR

mem_write_byte:
	movfw	INDF
	call I2c_send
	btfss	STATUS, Z
		goto mem_fail
	incf	FSR, f
	decfsz	mem_pos, f
		goto mem_write_byte

	call I2c_stop

mem_write_wait:
	call I2c_start
	movfw	mem_command
	call I2c_send
	btfss	STATUS, Z
		goto mem_write_wait

	call I2c_stop
	retlw 0x00




mem_fail:
	call I2c_stop
	retlw 0x01




i2c_byte	EQU		0x7F
i2c_state	EQU		0x7E


#define SCL PORTB,6
#define SDI PORTB,7
#define SDO TRISB,7

SDA_HIGH MACRO
	bcf		SDI
	bsf		STATUS, RP0
	bsf		SDO
	bcf		STATUS, RP0
ENDM

SDA_LOW MACRO
	bcf		SDI
	bsf		STATUS, RP0
	bcf		SDO
	bcf		STATUS, RP0
ENDM

SCL_HIGH MACRO
	bsf		SCL
ENDM

SCL_LOW MACRO
	bcf		SCL
ENDM

SWAIT MACRO
	nop
ENDM

I2c_pause:
	movwf	i2c_state
I2c_pause_loop:
	movlw	D'232'
I2c_pause_inner_loop:
	addlw	-D'1'
	btfss	STATUS, Z
		goto I2c_pause_inner_loop
	decfsz	i2c_state, f
		goto I2c_pause_loop
	return




I2c_start:
	bcf		STATUS, RP0
	bcf		SDI
	SDA_HIGH
	SWAIT
	SCL_HIGH
	SWAIT
	SDA_LOW
	SWAIT
	return

I2c_stop:
	SCL_LOW
	SWAIT
	SDA_LOW
	SWAIT
	SCL_HIGH
	SWAIT
	SDA_HIGH
	SWAIT
	return

I2c_send:
	movwf	i2c_byte
	movlw	0x08
	movwf	i2c_state
I2c_send_loop:
	SCL_LOW
	SWAIT
	btfss	i2c_byte, 7
		goto I2c_send_low
	SDA_HIGH
	goto I2c_send_high
I2c_send_low:
	SDA_LOW
I2c_send_high:
	SWAIT
	SCL_HIGH
	SWAIT
	rlf		i2c_byte, f
	decfsz	i2c_state, f
		goto I2c_send_loop
	; listen for ACK
	SCL_LOW
	SWAIT
	SDA_HIGH
	SWAIT
	SCL_HIGH
	SWAIT
	;bcf		SDI
	clrw
	btfsc	SDI
		addlw	D'1'
	SWAIT
	SCL_LOW
	return	; ack is status Z bit, 1 is ack, 0 is noack

I2c_recv:
	clrf	i2c_byte
	movlw	0x08
	movwf	i2c_state
I2c_recv_loop:
	SDA_HIGH
	SCL_LOW
	SWAIT
	SCL_HIGH
	SWAIT
	rlf		i2c_byte, f
	btfss	SDI
		goto I2c_recv_low
	bsf		i2c_byte, 0
	goto I2c_recv_high
I2c_recv_low:
	bcf		i2c_byte, 0
I2c_recv_high:
	decfsz	i2c_state, f
		goto I2c_recv_loop
	movfw	i2c_byte
	return

I2c_ack:
	SDA_HIGH
	SCL_LOW
	SWAIT
	SDA_LOW
	SWAIT
	SCL_HIGH
	SWAIT
	SCL_LOW
	return

I2c_noack:
	SDA_HIGH
	SCL_LOW
	SWAIT
	SDA_HIGH
	SWAIT
	SCL_HIGH
	SWAIT
	SCL_LOW
	return





	END                       ; directive 'end of program'
