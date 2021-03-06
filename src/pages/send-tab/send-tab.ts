import { Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicPage, NavController, NavParams, ViewController, Select, Platform, AlertController } from 'ionic-angular';
import { BarcodeScanner } from '@ionic-native/barcode-scanner';
import { FingerprintAIO } from '@ionic-native/fingerprint-aio';
import { PinDialog } from '@ionic-native/pin-dialog';
import { Subscription } from 'rxjs/Subscription';
import { TranslateService } from '@ngx-translate/core';
import { Keyboard } from '@ionic-native/keyboard';

import * as Big from 'big.js';

import { AccountDataProvider } from '../../providers/account-data/account-data';
import { SharedProvider } from '../../providers/shared/shared';
import { TransactionsProvider } from '../../providers/transactions/transactions';
import { CurrenciesProvider } from '../../providers/currencies/currencies';

@IonicPage()
@Component({
  selector: 'page-send-tab',
  templateUrl: 'send-tab.html',
})
export class SendTabPage {
  @ViewChild(Select) select: Select;

  private sendForm : FormGroup;
  recipient: string = '';
  amount: number;
  fee: number;
  amountCurrency: number;
  chain: number = 1;
  chainName: string = 'ARDR';
  message: string;
  decimals: number = 100000000;
  status: number;
  disableSend: boolean = false;
  resultTxt: string = '';
  contacts: object[];
  password: string;
  fingerAvailable: boolean = false;
  usePin: boolean = false;
  guest: boolean = false;
  hasPassphrase: boolean = false;
  passwordType: string = 'password';
  privateMsg: boolean = false;
  noContacts: string = 'No Saved Contacts';
  successSend: string = 'Successfully Sent';
  incorrectPass: string = 'Incorrect Passphrase';
  unknownAccount: string = 'Alias not found, or incorrect account address';
  enterPin: string = 'Enter your PIN';
  verifyPin: string = 'Verify your PIN';
  qrText: string = 'Place QR code inside the scan area';

  disableCurrency: boolean = false;
  currencyPlaceholder: string;

  eAddresses: string[] = []; //List of known exchange addresses

  price: number = 0;
  currency: string = 'USD';
  currencies: string[] = ['BTC','ETH','USD','EUR','CNY','AUD'];
  currencyDecimal: number = 2;
  currencyDecimals: number[] = [8,8,2,2,2,2];
  symbol: string = '$';
  currencySymbols: string[] = ['฿','Ξ','$','€','¥','A$'];

  subscriptionChain: Subscription;
  subscriptionCurrancy: Subscription;

  //Billing Number
  
  billNo : number = -1;
  total_coin : number = 0;
  coin_rate : string = '$1';
  trans_date : string = '';
  
  //messageToEncrypt
  messgeToEncrypt : string = "";


  constructor(public navCtrl: NavController, public accountData: AccountDataProvider, public navParams: NavParams, public viewCtrl: ViewController, private barcodeScanner: BarcodeScanner, private formBuilder: FormBuilder, private faio: FingerprintAIO, private pinDialog: PinDialog, public sharedProvider: SharedProvider, public transactions: TransactionsProvider, public currenciesProv: CurrenciesProvider, public platform: Platform, private alertCtrl: AlertController, public translate: TranslateService, private keyboard: Keyboard) {
  	this.sendForm = this.formBuilder.group({
      recipientForm: ['', Validators.required],
      amountForm: ['', Validators.required],
      amountCurrencyForm: [''],
      messageForm: [''],
      msgTypeForm: [''],
      billNoForm : [''],
      passwordForm: ['', Validators.required]
    });
    if (navParams.get('address')) {
      this.recipient = navParams.get('address');
    }

    //set the default password.
    //this.recipient = "COAL-MLCL-ECR4-5WGX-EDFZY";
    //this.amount = 10;
    //this.message = "hello world";
    //this.password = "cap pack grasp cheat slide beg quick wound example lucky give worst";
  }

  ionViewDidLoad() {
    this.guest = this.accountData.isGuestLogin();
  	if (!this.guest) {
      this.hasPassphrase = this.accountData.hasSavedPassword();
      if (this.platform.is('cordova')) {
        this.faio.isAvailable().then((available) => {
          if (available == 'OK' || available == 'Available' || available == 'finger' || available == 'face') {
            this.fingerAvailable = true;
            this.usePin = false;
          } else {
            this.fingerAvailable = false;
            this.usePin = true;
          }
        })
        .catch((error: any) => {
          console.log(error);
          this.usePin = true;
        });
      }
    }

    this.transactions.getExchanges()
    .subscribe(
        eAccounts => {
          if (eAccounts['errorDescription']) {
            
          } else {
            const eAccountsURI = eAccounts['aliasURI'];
            this.eAddresses = eAccountsURI.split("|");
          }
        }
    );

    this.translate.get('NO_SAVED_CONTACTS').subscribe((res: string) => {
        this.noContacts = res;
    });
    this.translate.get('INCORRECT_PASS').subscribe((res: string) => {
        this.incorrectPass = res;
    });
    this.translate.get('UNKNOWN_ALIAS_ADDRESS').subscribe((res: string) => {
        this.unknownAccount = res;
    });
    this.translate.get('ENTER_PIN').subscribe((res: string) => {
        this.enterPin = res;
    });
    this.translate.get('VERIFY_PIN').subscribe((res: string) => {
        this.verifyPin = res;
    });
    this.translate.get('QR_SCAN').subscribe((res: string) => {
        this.qrText = res;
    });


    this.loadContacts();
    this.subscriptionChain = this.sharedProvider.getChain().subscribe(sharedChain => {
      this.chain = sharedChain; 
      this.chainName = this.sharedProvider.getChainNameOnce();
      this.decimals = Math.pow(10, this.sharedProvider.getConstants()['chainProperties'][this.chain]['decimals']);
      this.price = this.sharedProvider.getPriceOnce();
      if (!this.amountCurrency || this.amountCurrency <= 0) {
        this.updateConversion('currency');
      }
    });

    this.subscriptionCurrancy = this.sharedProvider.getCurrancy().subscribe(sharedCurrancy => {
      let sharedCurrancyNumber = this.currencies.indexOf(sharedCurrancy);
      this.currency = sharedCurrancy;
      this.symbol = this.currencySymbols[sharedCurrancyNumber];
      this.currencyDecimal = this.currencyDecimals[sharedCurrancyNumber];
      this.price = this.sharedProvider.getPriceOnce();
      this.updateConversion('chain');
    });
    
  }

  // updatePrice() {
  //   let currencyChain;
  //   if (this.chainName == 'BITSWIFT') {
  //     currencyChain = 'SWIFT';
  //   } else {
  //     currencyChain = this.chainName;
  //   }

  //   this.currenciesProv.getPrice(currencyChain, this.currency)
  //   .subscribe(
  //     price => {
  //       if (price != null && price[`${this.currency}`] != null) {
  //         this.price = price[`${this.currency}`];
  //       }
  //     },
  //     err => { console.log(err); });
  // }

  updateConversion(type: string) {
    if (this.chainName == 'AEUR') {
      this.disableCurrency = true;
      this.amountCurrency = null;
      this.currencyPlaceholder = "Unavailable";
    } else {
      this.disableCurrency = false;
      this.currencyPlaceholder = null;
    }
    if (type == 'chain') {
      if (this.amount && this.amount > 0 && !this.disableCurrency) {
        let amountCurrencyBig = new Big(this.amount * this.price)
        this.amountCurrency = amountCurrencyBig.round(this.currencyDecimal);
      }
    } else {
      if (this.amountCurrency && this.amountCurrency > 0) {
        let amountBig = new Big(this.amountCurrency / this.price)
        this.amount = amountBig.round(this.sharedProvider.getConstants()['chainProperties'][this.chain]['decimals']);
      }
    }
  }

  handleEnter() {
    this.keyboard.hide();
  }

  exchangeCheck() { 
    if ((!this.message || this.message == '') && this.eAddresses.indexOf(this.recipient.toLowerCase()) != -1) {
      let alert = this.alertCtrl.create({
        title: 'Exchange Warning',
        message: `It appears you are sending to an exchange without a message.  Exchanges typically require a message to credit the correct account.  Are you sure you want to continue without a message?`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              console.log('Cancel clicked');
            }
          },
          {
            text: 'Continue',
            handler: () => {
              this.presentConfirm();
            }
          }
        ]
      });
      alert.present();
    } else {
      this.presentConfirm();
    }
  }

  presentConfirm() {
    console.log('Message :' + this.message);
    console.log('Private Message :' + this.privateMsg);
    
    let convertedPassword = this.accountData.convertPasswordToAccount(this.password).replace("ARDOR","COAL");
    console.log('converted password:' + convertedPassword);
    if (convertedPassword === this.accountData.getAccountID()) {
      let chainName = this.sharedProvider.getConstants()['chainProperties'][this.chain]['name'];
      let alert = this.alertCtrl.create({
        title: 'Confirm transfer',
        message: `Please confirm you want to send <b>${this.amount} ${chainName}</b><br />to<br /><b>${this.recipient}</b>.<br/><br/><b>This cannot be reversed.</b>`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              console.log('Cancel clicked');
            }
          },
          {
            text: 'Send',
            handler: () => {
              this.onSend();
            }
          }
        ]
      });
      alert.present();
    } else {
      this.resultTxt = this.incorrectPass;
      this.status = -1;
    }
  }

  onSend() {
    if (this.recipient.substring(0, 4) != "UST-" && this.recipient.substring(0, 5) != "COAL-" && this.recipient.substring(0, 4) != "SGT-" && this.recipient.substring(0, 4) != "MYR-" && this.recipient.substring(0, 6) != "ASEAN-" || this.recipient.length < 20 || this.recipient.length > 26) {
       this.accountData.getAlias('ust', this.recipient)
        .subscribe(
          alias => {
            if (alias['errorDescription']) {
              this.resultTxt = this.unknownAccount;
              this.status = -1;
            } else {
              this.onSendAfterAliasCheck(alias['accountRS']);
            }
          });
    } else {
      this.onSendAfterAliasCheck(this.recipient);
    }
  }

  onSendAfterAliasCheck(recipient:string) {
    console.log('star_messageencrypted:' + this.messgeToEncrypt);
    this.disableSend = true;
    let amountBig = new Big(this.amount);
    let convertedAmount = new Big(amountBig.times(this.decimals));
    let chainName = this.sharedProvider.getConstants()['chainProperties'][this.chain]['name'];
    this.resultTxt = `Attempting to send ${recipient} ${amountBig} ${chainName}`;
    this.status = 0;
    this.accountData.setPublicKeyPassword(this.password);
    this.message = this.messgeToEncrypt;
    // this.transactions.sendMoney(this.chain, recipient, convertedAmount, this.message, this.privateMsg)
    this.transactions.sendMoney(this.chain, recipient, convertedAmount, this.message, this.privateMsg)
    .subscribe(
      unsignedBytes => {
        console.log('star_sendMoney() excuted: returned unsigned bytes:' + JSON.stringify(unsignedBytes));
        if (unsignedBytes['errorDescription'] || !unsignedBytes['unsignedTransactionBytes']) {
            this.resultTxt = unsignedBytes['errorDescription'];
            this.disableSend = false;
            this.status = -1;
        } else {
          this.resultTxt = `Signing transaction and sending ${recipient} ${amountBig} ${chainName}`;
          console.log('star_resultText:' + this.resultTxt);
          let attachment = null;
          if (this.message && this.message != '') {
            attachment = unsignedBytes['transactionJSON']['attachment'];
          }
          let signedTx = this.accountData.verifyAndSignTransaction(unsignedBytes['unsignedTransactionBytes'], this.password, 'sendMoney', { recipient: recipient, amountNQT: convertedAmount.toString() });
          console.log('star_signedTx : ' + signedTx);
          if (signedTx != 'failed') {
            this.transactions.broadcastTransaction(signedTx, attachment)
            .subscribe(
              broadcastResults => {
                if (broadcastResults['fullHash'] != null) {
                  this.translate.get('SUCCESS_SEND', {recipient: recipient, amountBig: amountBig, chainName: chainName}).subscribe((res: string) => {
                      this.successSend = res;
                      // this.resultTxt = `Successfully sent! Transaction fullHash: ${broadcastResults['fullHash']}`;
                      this.resultTxt = this.successSend;
                      this.status = 1;

                      //star_ send success request.
                      this.transactions.sendServer(this.recipient,this.accountData.getAccountID(),this.total_coin,this.coin_rate,this.amount,this.billNo,this.trans_date).
                      subscribe((resp) => {
                          console.log('star_The information was submitted:' + resp.toString());
                      });
                      
                  });
                } else {
                  this.resultTxt = `Send Failed - ${broadcastResults['errorDescription']}`;
                  this.status = -1;
                  this.disableSend = false;
                }
              }
            );
          } else {
            this.resultTxt = 'Send Failed - WARNING: Transaction returned from node is incorrect';
            this.status = -1;
            this.disableSend = false;
          }
        }
      }
    );
  }

  openContacts() {
    this.select.open();
  }

  loadContacts() {
    this.accountData.getContacts().then((currentContacts) => {
      if (currentContacts != null) {
        this.contacts = currentContacts;
      } else {
        this.contacts = [{ name:this.noContacts,account:'' }];
      }
    });
  }

  togglePassword() {
  	if (this.passwordType == 'password') {
  		this.passwordType = 'text';
  	} else {
  		this.passwordType = 'password';
  	}
  }

  setMsg() {
    this.privateMsg = !this.privateMsg;
  }

  showFingerprint() {
    this.faio.show({
      clientId: 'Coal-Lite',
      clientSecret: this.accountData.getFingerSecret(), //Only necessary for Android
      disableBackup: false,  //Only for Android(optional)
      localizedFallbackTitle: 'Use Pin', //Only for iOS
      localizedReason: 'Please authenticate' //Only for iOS
    })
    .then((result: any) => { 
    	this.password = this.accountData.getSavedPassword();
    })
    .catch((error: any) => console.log(error));
  }

  showPin() {
    this.pinDialog.prompt(this.enterPin, this.verifyPin, ['OK', 'Cancel'])
    .then(
      (result: any) => {
        if (result.buttonIndex == 1) {
          if (this.accountData.checkPin(result.input1)) {
            this.password = this.accountData.getSavedPassword();
          } else {
            this.presentMessage("Incorrect PIN");
          }
        } else if(result.buttonIndex == 2) {
          console.log('User cancelled');
        }
      }
    );
  }

  openBarcodeScanner() {
    this.barcodeScanner.scan({prompt : this.qrText, disableSuccessBeep: true}).then((barcodeData) => {
      //this.recipient = barcodeData['text'];
      let qrCode =  barcodeData['text'];
      //prcessing barcode scan
      var code_array = qrCode.split("|");
      //check if it contains bill_no
      this.messgeToEncrypt = "Payment: <br>";
      code_array.forEach((item,index) => {
          console.log('item:' + item);
          var elements = item.split("=");

          if(elements[0].trim() === "pay_to") {
            this.recipient = elements[1].trim();

          }
          else if(elements[0].trim() === "bill_no"){
            this.billNo = parseInt(elements[1].trim());
          }
          else if(elements[0].trim() === "total_coin"){
            this.total_coin = parseInt(elements[1].trim());
            this.amount = this.total_coin;
          }
          else if(elements[0].trim() === "coin_rate"){
            this.coin_rate = elements[1].trim();
          }
          else if(elements[0].trim() === "amount"){
            
          }
          else if(elements[0].trim() === "trans_date"){
            this.trans_date = elements[1].trim();
          }

          if(index === code_array.length - 1) this.messgeToEncrypt = this.messgeToEncrypt + item + "<br>";
          else{
            this.messgeToEncrypt = this.messgeToEncrypt = this.messgeToEncrypt + item + "</br>";;
          }

          //this.amount = parseInt(this.coin_rate.replace(/[^a-zA-Z ]/g, "")) * this.total_coin;
          
      });

    }, (err) => {
        // An error occurred
    });
  }

  openBarcodeScannerPassword(password: string) {
  	this.barcodeScanner.scan({prompt : this.qrText, disableSuccessBeep: true}).then((barcodeData) => {
     	this.password = barcodeData['text'];
    }, (err) => {
        // An error occurred
    });
  }

  presentMessage(msg: string) {
    let alert = this.alertCtrl.create({
      title: msg,
      buttons: ['Dismiss']
    });
    alert.present();
  }

  ionViewDidLeave() { 
    this.subscriptionChain.unsubscribe();
    this.subscriptionCurrancy.unsubscribe();
  }

  //reset the status
  closeSuccess(){
    
    this.status = 0;
    this.recipient = '';
    this.disableSend = false;
    this.sendForm.clearValidators();
    this.amount = 0;
    this.billNo = -1;
    this.privateMsg = false;
    this.message = '';
    this.resultTxt = '';
    this.password = '';

  }

}
