import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { generatePageMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return generatePageMetadata({ params }, "Metadata.terms", "/terms");
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const isZH = locale === "zh";

  return (
    <div className="mx-auto max-w-4xl py-12">
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            {isZH ? "服务条款" : "Terms of Service"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isZH ? "最后更新：2026年5月3日" : "Last updated: May 3, 2026"}
          </p>
          {isZH && (
            <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ 本服务条款目前仅提供英文版本。英文版本为具有法律约束力的正式版本。
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                These Terms of Service are currently available in English only. The{" "}
                <Link href="/terms" locale="en" className="underline font-medium">
                  English version
                </Link>{" "}
                is the legally binding version.
              </p>
            </div>
          )}
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-lg">
            These Terms of Service (the &quot;Agreement&quot;) explain the terms and conditions by
            which you may access and use the Products provided by Isometric (referred to herein as
            &quot;Isometric,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). The Products
            shall include, but shall not necessarily be limited to, (a) a website-hosted user
            interface located at https://isometric.fi (the &quot;Interface&quot; or &quot;App&quot;)
            and (b) any other products and services that link to this Agreement (together with the
            Interface and App, the &quot;Products&quot;). You must read this Agreement carefully as
            it governs your use of the Products. By accessing or using any of the Products, you
            signify that you have read, understand, and agree to be bound by this Agreement in its
            entirety. If you do not agree, you are not authorized to access or use any of our
            Products and should not use our Products.
          </p>

          <p>
            To access or use any of our Products, you must be able to form a legally binding
            contract with us. Accordingly, you represent that you are at least the age of majority
            in your jurisdiction (e.g., 18 years old in the United States) and have the full right,
            power, and authority to enter into and comply with the terms and conditions of this
            Agreement on behalf of yourself and any company or legal entity for which you may access
            or use the Interface. If you are entering into this Agreement on behalf of an entity,
            you represent to us that you have the legal authority to bind such entity.
          </p>

          <p>
            You further represent that you are not (a) the subject of economic or trade sanctions
            administered or enforced by any governmental authority or otherwise designated on any
            list of prohibited or restricted parties (including but not limited to the list
            maintained by the Office of Foreign Assets Control of the U.S. Department of the
            Treasury) or (b) a citizen, resident, or organized in a jurisdiction or territory that
            is the subject of comprehensive country-wide, territory-wide, or regional economic
            sanctions by the United States. Finally, you represent that your access and use of any
            of our Products will fully comply with all applicable laws and regulations, and that you
            will not access or use any of our Products to conduct, promote, or otherwise facilitate
            any illegal activity.
          </p>

          <p className="font-semibold">
            NOTICE: This Agreement contains important information, including binding terms regarding
            limitation of liability and dispute resolution, both of which impact your rights as to
            how disputes are resolved. Our Products are only available to you — and you should only
            access any of our Products — if you agree completely with these terms.
          </p>

          <section className="space-y-4 mt-8">
            <h2 className="text-2xl font-semibold">1. Our Products</h2>

            <h3 className="text-xl font-medium mt-6">1.1 The Interface</h3>
            <p>
              The Interface provides a web-based means of access to a decentralized protocol on the
              Internet Computer blockchain that allows users to trade Bitcoin options contracts. The
              Interface is distinct from the Isometric Protocol and is one, but not the exclusive,
              means of accessing the Protocol.
            </p>
            <p>
              The Protocol comprises open-source self-executing smart contracts (canisters) that are
              deployed on the Internet Computer blockchain. Isometric does not control or operate
              the Protocol on the blockchain network. By using the Interface, you understand that
              you are not buying or selling digital assets from us and that we do not operate any
              liquidity pools or control trade execution. When traders pay fees for trades, those
              fees are processed by the Protocol smart contracts. As a general matter, Isometric is
              not a liquidity provider and liquidity providers are independent third parties.
            </p>
            <p>
              To access the Interface, you must use a blockchain wallet, which allows you to
              interact with public blockchains. Your relationship with that wallet provider is
              governed by the applicable terms of service. We do not have custody or control over
              the contents of your wallet and have no ability to retrieve or transfer its contents.
              By connecting your wallet to our Interface, you agree to be bound by this Agreement
              and all of the terms incorporated herein by reference.
            </p>

            <h3 className="text-xl font-medium mt-6">1.2 Third-Party Services and Content</h3>
            <p>
              Our Products may include integrations, links or other access to third-party services,
              sites, technology, APIs, content and resources (each a &quot;Third-Party
              Service&quot;). Your access and use of the Third-Party Services may also be subject to
              additional terms and conditions, privacy policies, or other agreements with such third
              party, and you may be required to authenticate to or create separate accounts to use
              Third-Party Services on the websites or via the technology platforms of their
              respective providers. You agree to comply with all terms, conditions, and policies
              applicable to any Third-Party Services integrated with or made available through the
              Products.
            </p>
            <p>
              You, and not Isometric, will be responsible for any and all costs and charges
              associated with your use of any Third-Party Services. Isometric enables these
              Third-Party Services merely as a convenience and the integration or inclusion of such
              Third-Party Services does not imply an endorsement or recommendation. Any dealings you
              have with third parties while using our Products are between you and the third party.
              Isometric will not be responsible or liable, directly or indirectly, for any damage or
              loss caused or alleged to be caused by or in connection with use of or reliance on any
              Third-Party Services.
            </p>
          </section>

          <section className="space-y-4 mt-8">
            <h2 className="text-2xl font-semibold">
              2. Modifications of this Agreement or our Products
            </h2>

            <h3 className="text-xl font-medium mt-6">2.1 Modifications of this Agreement</h3>
            <p>
              We reserve the right, in our sole discretion, to modify this Agreement from time to
              time. If we make any material modifications, we will (a) update the date at the top of
              the Agreement, (b) maintain a current version of the Agreement at
              https://isometric.fi/terms, and (c) where reasonably practicable, surface notice of
              the change through the Interface (for example, via an in-app banner or notification on
              your next session). Modifications will be effective when posted, and your continued
              access to or use of any of the Products following the effective date will serve as
              confirmation of your acceptance of those modifications. If you do not agree with any
              modifications to this Agreement, you must immediately stop accessing and using all of
              our Products.
            </p>

            <h3 className="text-xl font-medium mt-6">2.2 Modifications of our Products</h3>
            <p>
              We reserve the following rights, which do not constitute obligations of ours: (a) with
              or without notice to you, to modify, substitute, eliminate or add to any of the
              Products; (b) to review, modify, filter, disable, delete and remove any and all
              content and information from any of the Products.
            </p>
          </section>

          <section className="space-y-4 mt-8">
            <h2 className="text-2xl font-semibold">3. Intellectual Property Rights</h2>
            <p>
              We own all intellectual property and other rights in each of our Products and its
              respective contents, including, but not limited to, software, text, images,
              trademarks, service marks, copyrights, patents, designs, and its &quot;look and
              feel.&quot; Subject to the terms of this Agreement, we grant you a limited, revocable,
              non-exclusive, non-sublicensable, non-transferable license to access and use our
              Products solely in accordance with this Agreement. You agree that you will not use,
              modify, distribute, tamper with, reverse engineer, disassemble or decompile any of our
              Products for any purpose other than as expressly permitted pursuant to this Agreement.
            </p>
            <p>
              You understand and acknowledge that the Protocol is not a Product and we do not
              control the Protocol.
            </p>
          </section>

          <section className="space-y-4 mt-8">
            <h2 className="text-2xl font-semibold">4. Your Responsibilities</h2>

            <h3 className="text-xl font-medium mt-6">4.1 Prohibited Activity</h3>
            <p>
              You agree not to engage in, or attempt to engage in, any of the following categories
              of prohibited activity in relation to your access and use of the Interface:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Intellectual Property Infringement.</strong> Activity that infringes on or
                violates any copyright, trademark, service mark, patent, right of publicity, right
                of privacy, or other proprietary or intellectual property rights under the law.
              </li>
              <li>
                <strong>Cyberattack.</strong> Activity that seeks to interfere with or compromise
                the integrity, security, or proper functioning of any computer, server, network,
                personal device, or other information technology system, including, but not limited
                to, the deployment of viruses and denial of service attacks.
              </li>
              <li>
                <strong>Fraud and Misrepresentation.</strong> Activity that seeks to defraud us or
                any other person or entity, including, but not limited to, providing any false,
                inaccurate, or misleading information in order to unlawfully obtain the property of
                another.
              </li>
              <li>
                <strong>Market Manipulation.</strong> Activity that violates any applicable law,
                rule, or regulation concerning the integrity of trading markets, including, but not
                limited to, the manipulative tactics commonly known as spoofing and wash trading.
              </li>
              <li>
                <strong>Securities and Derivatives Violations.</strong> Activity that violates any
                applicable law, rule, or regulation concerning the trading of securities or
                derivatives, including, but not limited to, the unregistered offering of securities
                and the offering of leveraged and margined commodity products to retail customers in
                the United States.
              </li>
              <li>
                <strong>Money Laundering and Sanctions Violations.</strong> Activity that involves
                or facilitates money laundering, terrorism financing, proliferation financing, or
                any other illegal financial activity, or that uses the Products to engage in or
                support transactions prohibited by applicable anti-money-laundering, counter-
                terrorist-financing, or sanctions laws or regulations.
              </li>
              <li>
                <strong>Exploitation of Vulnerabilities.</strong> Activity that exploits, or
                attempts to exploit, any error, bug, vulnerability, mispricing, oracle failure, race
                condition, state inconsistency, or unintended behavior of the Products, the
                Protocol, or any associated smart contract, code, or infrastructure, including any
                attempt to gain unauthorized access, extract value through unintended mechanisms, or
                manipulate transaction ordering or settlement.
              </li>
              <li>
                <strong>Data Mining or Scraping.</strong> Activity that involves data mining,
                robots, scraping, or similar data gathering or extraction methods of content or
                information from any of our Products.
              </li>
              <li>
                <strong>Any Other Unlawful Conduct.</strong> Activity that violates any applicable
                law, rule, or regulation of the United States or another relevant jurisdiction,
                including, but not limited to, the restrictions and regulatory requirements imposed
                by U.S. law.
              </li>
            </ul>

            <h3 className="text-xl font-medium mt-6">4.2 Trading</h3>
            <p>
              You agree and understand that: (a) all trades you submit through any of our Products
              are considered unsolicited, which means that they are solely initiated by you; (b) you
              have not received any investment advice from us in connection with any trades; and (c)
              we do not conduct a suitability review of any trades you submit.
            </p>

            <h3 className="text-xl font-medium mt-6">4.3 No Fiduciary Duties</h3>
            <p>
              Each of the Products operates as a smart contract protocol. We do not ever have
              custody, possession, or control of your digital assets at any time. It further means
              you are solely responsible for the custody of the cryptographic private keys to the
              digital asset wallets you hold and you should never share your wallet credentials or
              seed phrase with anyone. We accept no responsibility for, or liability to you, in
              connection with your use of a wallet and make no representations or warranties
              regarding how any of our Products will operate with any specific wallet. Likewise, you
              are solely responsible for any associated wallet and we are not liable for any acts or
              omissions by you in connection with or as a result of your wallet being compromised.
            </p>
            <p>
              This Agreement is not intended to, and does not, create or impose any fiduciary duties
              on us. To the fullest extent permitted by law, you acknowledge and agree that we owe
              no fiduciary duties or liabilities to you or any other party, and that to the extent
              any such duties or liabilities may exist at law or in equity, those duties and
              liabilities are hereby irrevocably disclaimed, waived, and eliminated. You further
              agree that the only duties and obligations that we owe you are those set out expressly
              in this Agreement.
            </p>

            <h3 className="text-xl font-medium mt-6">4.4 Compliance and Tax Obligations</h3>
            <p>
              One or more of our Products may not be available or appropriate for use in your
              jurisdiction. By accessing or using any of our Products, you agree that you are solely
              and entirely responsible for compliance with all laws and regulations that may apply
              to you. Specifically, your use of our Products or the Protocol may result in various
              tax consequences, such as income or capital gains tax, value-added tax, goods and
              services tax, or sales tax in certain jurisdictions.
            </p>
            <p>
              It is your responsibility to determine whether taxes apply to any transactions you
              initiate or receive and, if so, to report and/or remit the correct tax to the
              appropriate tax authority.
            </p>

            <h3 className="text-xl font-medium mt-6">4.5 Gas Fees</h3>
            <p>
              Blockchain transactions require the payment of transaction fees to the appropriate
              network. Except as otherwise expressly set forth in the terms of another offer by
              Isometric, you will be solely responsible to pay the transaction fees for any
              transaction that you initiate via any of our Products.
            </p>

            <h3 className="text-xl font-medium mt-6">4.6 Release of Claims</h3>
            <p>
              You expressly agree that you assume all risks in connection with your access and use
              of any of our Products. You further expressly waive and release us from any and all
              liability, claims, causes of action, or damages arising from or in any way relating to
              your use of any of our Products.
            </p>

            <h3 className="text-xl font-medium mt-6">4.7 Restricted Persons and Jurisdictions</h3>
            <p>
              You may not access or use the Products if you are (a) a U.S. Person; (b) a person or
              entity who resides in, is located in, is incorporated in, or has a registered office
              in the Province of Ontario, Canada; (c) a citizen, resident, or legal entity organized
              in, or accessing the Products from, a jurisdiction subject to comprehensive sanctions
              administered or enforced by the United States, the United Kingdom, the European Union,
              or the United Nations (including, without limitation, Cuba, Iran, North Korea, Syria,
              the Russian Federation, Belarus, and the Crimea, Donetsk, Luhansk, Zaporizhzhia, and
              Kherson regions of Ukraine, and any other jurisdiction so designated from time to time
              (collectively, &quot;Restricted Jurisdictions&quot;)); or (d) listed on, or owned or
              controlled by a person listed on, any sanctions or restricted-party list maintained by
              any governmental authority, including the U.S. Office of Foreign Assets Control
              Specially Designated Nationals and Blocked Persons List (each of (a) through (d), a
              &quot;Restricted Person&quot;).
            </p>
            <p>
              You further represent and warrant that your access to and use of the Products,
              including any leveraged, margined, options, or other derivative trading conducted
              through the Products, is lawful in your jurisdiction of residence, citizenship, and
              access, and that you are not subject to any registration, licensing, suitability, or
              eligibility requirement that would prohibit or restrict your access to or use of the
              Products under applicable law. You are solely responsible for determining whether such
              trading is lawful for you, and you assume all risk and liability for any determination
              that proves incorrect.
            </p>
            <p>
              For purposes of this Agreement, &quot;U.S. Person&quot; has the meaning given in Rule
              902(k) of Regulation S under the U.S. Securities Act of 1933, and includes, without
              limitation: any natural person resident in the United States; any partnership,
              corporation, limited liability company, or other entity organized or incorporated
              under the laws of the United States; any estate or trust of which any executor,
              administrator, or trustee is a U.S. Person; any agency or branch of a non-U.S. entity
              located in the United States; and any account (whether discretionary or
              non-discretionary) held by a dealer or other fiduciary for the benefit or account of a
              U.S. Person.
            </p>
            <p>
              You represent and warrant that you are not a Restricted Person, that you are not
              accessing the Products on behalf of any Restricted Person, and that you will notify us
              immediately and cease all use of the Products if your status changes. We may, at our
              sole discretion and without notice, implement geofencing, IP-based access controls,
              wallet screening, or other measures to restrict access to the Products from any
              jurisdiction or to any wallet address. You are solely responsible for ensuring that
              your access to and use of the Products is lawful in your jurisdiction.
            </p>

            <h3 className="text-xl font-medium mt-6">4.8 No Circumvention</h3>
            <p>
              You will not, and will not assist or permit any third party to, (a) use any virtual
              private network, proxy, anonymizer, location-spoofing service, decentralized identity
              workaround, or other technical, contractual, or operational means to access the
              Products from a Restricted Jurisdiction, to mask your status as a Restricted Person,
              or to obscure your true location; (b) make any false, misleading, or incomplete
              statement or representation regarding your residency, citizenship, location, identity,
              beneficial ownership, source of funds, or compliance with any applicable law, in
              connection with your access to or use of the Products; or (c) otherwise circumvent or
              attempt to circumvent any access restriction, screening measure, eligibility
              requirement, or other control we may impose. By accessing or using the Products, you
              affirmatively represent and warrant that you are not a Restricted Person and have not
              engaged in any of the foregoing. Any breach of this Section is a material breach of
              this Agreement and constitutes grounds for immediate termination of your access to the
              Products, in addition to any other remedies available to us at law or in equity.
            </p>

            <h3 className="text-xl font-medium mt-6">4.9 Final and Binding Determinations</h3>
            <p>
              Our determinations regarding the eligibility of any user, wallet, or transaction to
              access or interact with any feature of the Products, as well as any questions or
              disputes arising from a user&apos;s access to or use of the Products, including
              determinations made under Sections 4.7 and 4.8, shall be final and binding and not
              subject to challenge or appeal, except where mandatory applicable law provides
              otherwise. Without notice to you, we reserve the right to suspend, restrict, or
              terminate your access to any feature of the Products in our sole discretion,
              including, without limitation, where we determine or suspect that your access or use
              is unauthorized, deceptive, fraudulent, unlawful, in breach of this Agreement, or
              would require suspension or termination to comply with applicable laws, regulations,
              or legal orders.
            </p>
          </section>

          <section className="space-y-4 mt-8">
            <h2 className="text-2xl font-semibold">5. DISCLAIMERS</h2>

            <h3 className="text-xl font-medium mt-6">5.1 ASSUMPTION OF RISK</h3>
            <p>
              BY ACCESSING AND USING ANY OF OUR PRODUCTS, YOU REPRESENT THAT YOU ARE FINANCIALLY AND
              TECHNICALLY SOPHISTICATED ENOUGH TO UNDERSTAND THE INHERENT RISKS ASSOCIATED WITH
              USING CRYPTOGRAPHIC AND BLOCKCHAIN-BASED SYSTEMS, AND THAT YOU HAVE A WORKING
              KNOWLEDGE OF THE USAGE AND INTRICACIES OF DIGITAL ASSETS SUCH AS BITCOIN (BTC),
              CHAIN-KEY BITCOIN (CKBTC), AND OTHER DIGITAL TOKENS.
            </p>
            <p>
              IN PARTICULAR, YOU UNDERSTAND THAT THE MARKETS FOR THESE DIGITAL ASSETS ARE NASCENT
              AND HIGHLY VOLATILE DUE TO RISK FACTORS INCLUDING, BUT NOT LIMITED TO, ADOPTION,
              SPECULATION, TECHNOLOGY, SECURITY, AND REGULATION. YOU UNDERSTAND THAT OPTIONS TRADING
              INVOLVES SUBSTANTIAL RISK OF LOSS AND IS NOT SUITABLE FOR ALL INVESTORS.
            </p>
            <p>
              FURTHER, YOU UNDERSTAND THAT SMART CONTRACT TRANSACTIONS AUTOMATICALLY EXECUTE AND
              SETTLE, AND THAT BLOCKCHAIN-BASED TRANSACTIONS ARE IRREVERSIBLE WHEN CONFIRMED. YOU
              ACKNOWLEDGE AND ACCEPT THAT THE COST AND SPEED OF TRANSACTING WITH CRYPTOGRAPHIC AND
              BLOCKCHAIN-BASED SYSTEMS SUCH AS THE INTERNET COMPUTER ARE VARIABLE AND MAY INCREASE
              DRAMATICALLY AT ANY TIME.
            </p>
            <p>
              IF YOU ACT AS A LIQUIDITY PROVIDER OR OPTION WRITER THROUGH THE INTERFACE, YOU
              UNDERSTAND THAT YOUR DIGITAL ASSETS MAY LOSE SOME OR ALL OF THEIR VALUE WHILE THEY ARE
              SUPPLIED TO THE PROTOCOL THROUGH THE INTERFACE DUE TO THE FLUCTUATION OF PRICES AND
              SETTLEMENT OF OPTIONS CONTRACTS.
            </p>
            <p>
              YOU FURTHER ACKNOWLEDGE RISKS SPECIFIC TO THE INTERNET COMPUTER PROTOCOL AND ITS
              BITCOIN INTEGRATION, INCLUDING WITHOUT LIMITATION: SUBNET FAILURES, REPLICA NODE
              OUTAGES, CANISTER UPGRADE FAILURES OR FREEZES, CYCLES EXHAUSTION, NETWORK NERVOUS
              SYSTEM (NNS) GOVERNANCE DECISIONS THAT MAY ALTER PROTOCOL BEHAVIOR, ckBTC MINTING OR
              REDEMPTION OUTAGES, BITCOIN NETWORK CONGESTION OR REORGANIZATIONS, AND THIRD-PARTY
              ORACLE OR PRICE-FEED FAILURES, MISPRICINGS, OR MANIPULATIONS. YOU ACCEPT THAT ANY OF
              THE FOREGOING MAY DELAY, PREVENT, OR ALTER THE EXECUTION OR SETTLEMENT OF YOUR
              TRANSACTIONS, AND THAT WE ARE NOT RESPONSIBLE OR LIABLE FOR ANY LOSSES ARISING FROM
              THEM.
            </p>
            <p>
              IN SUMMARY, YOU ACKNOWLEDGE THAT WE ARE NOT RESPONSIBLE FOR ANY OF THESE VARIABLES OR
              RISKS, DO NOT OWN OR CONTROL THE PROTOCOL, AND CANNOT BE HELD LIABLE FOR ANY RESULTING
              LOSSES THAT YOU EXPERIENCE WHILE ACCESSING OR USING ANY OF OUR PRODUCTS. ACCORDINGLY,
              YOU UNDERSTAND AND AGREE TO ASSUME FULL RESPONSIBILITY FOR ALL OF THE RISKS OF
              ACCESSING AND USING THE INTERFACE TO INTERACT WITH THE PROTOCOL.
            </p>

            <h3 className="text-xl font-medium mt-6">5.2 NO WARRANTIES</h3>
            <p>
              EACH OF OUR PRODUCTS IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
              BASIS. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ANY REPRESENTATIONS AND
              WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING, BUT NOT
              LIMITED TO, THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
              YOU ACKNOWLEDGE AND AGREE THAT YOUR USE OF EACH OF OUR PRODUCTS IS AT YOUR OWN RISK.
              WE DO NOT REPRESENT OR WARRANT THAT ACCESS TO ANY OF OUR PRODUCTS WILL BE CONTINUOUS,
              UNINTERRUPTED, TIMELY, OR SECURE; THAT THE INFORMATION CONTAINED IN ANY OF OUR
              PRODUCTS WILL BE ACCURATE, RELIABLE, COMPLETE, OR CURRENT; OR THAT ANY OF OUR PRODUCTS
              WILL BE FREE FROM ERRORS, DEFECTS, VIRUSES, OR OTHER HARMFUL ELEMENTS. NO ADVICE,
              INFORMATION, OR STATEMENT THAT WE MAKE SHOULD BE TREATED AS CREATING ANY WARRANTY
              CONCERNING ANY OF OUR PRODUCTS. WE DO NOT ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY
              FOR ANY ADVERTISEMENTS, OFFERS, OR STATEMENTS MADE BY THIRD PARTIES CONCERNING ANY OF
              OUR PRODUCTS.
            </p>
            <p>
              SIMILARLY, THE PROTOCOL IS PROVIDED &quot;AS IS,&quot; AT YOUR OWN RISK, AND WITHOUT
              WARRANTIES OF ANY KIND. ALTHOUGH WE CONTRIBUTED TO THE INITIAL CODE FOR THE PROTOCOL,
              WE DO NOT PROVIDE, OWN, OR CONTROL THE PROTOCOL, WHICH IS RUN AUTONOMOUSLY WITHOUT ANY
              HEADCOUNT BY SMART CONTRACTS DEPLOYED ON THE INTERNET COMPUTER BLOCKCHAIN. NO
              DEVELOPER OR ENTITY INVOLVED IN CREATING THE PROTOCOL WILL BE LIABLE FOR ANY CLAIMS OR
              DAMAGES WHATSOEVER ASSOCIATED WITH YOUR USE, INABILITY TO USE, OR YOUR INTERACTION
              WITH OTHER USERS OF, THE PROTOCOL, INCLUDING ANY DIRECT, INDIRECT, INCIDENTAL,
              SPECIAL, EXEMPLARY, PUNITIVE OR CONSEQUENTIAL DAMAGES, OR LOSS OF PROFITS,
              CRYPTOCURRENCIES, TOKENS, OR ANYTHING ELSE OF VALUE.
            </p>
            <p>
              ANY PAYMENTS OR FINANCIAL TRANSACTIONS THAT YOU ENGAGE IN WILL BE PROCESSED VIA
              AUTOMATED SMART CONTRACTS. ONCE EXECUTED, WE HAVE NO CONTROL OVER THESE PAYMENTS OR
              TRANSACTIONS, NOR DO WE HAVE THE ABILITY TO REVERSE ANY PAYMENTS OR TRANSACTIONS.
            </p>

            <h3 className="text-xl font-medium mt-6">5.3 NO INVESTMENT ADVICE</h3>
            <p>
              WE MAY PROVIDE INFORMATION ABOUT TOKENS OR OPTIONS CONTRACTS IN OUR PRODUCTS. THE
              PROVISION OF INFORMATIONAL MATERIALS DOES NOT MAKE TRADES IN THOSE TOKENS SOLICITED;
              WE ARE NOT ATTEMPTING TO INDUCE YOU TO MAKE ANY PURCHASE AS A RESULT OF INFORMATION
              PROVIDED. ALL SUCH INFORMATION PROVIDED BY ANY OF OUR PRODUCTS IS FOR INFORMATIONAL
              PURPOSES ONLY AND SHOULD NOT BE CONSTRUED AS INVESTMENT ADVICE OR A RECOMMENDATION
              THAT A PARTICULAR TOKEN OR OPTIONS CONTRACT IS A SAFE OR SOUND INVESTMENT. YOU SHOULD
              NOT TAKE, OR REFRAIN FROM TAKING, ANY ACTION BASED ON ANY INFORMATION CONTAINED IN ANY
              OF OUR PRODUCTS. BY PROVIDING INFORMATION FOR YOUR CONVENIENCE, WE DO NOT MAKE ANY
              INVESTMENT RECOMMENDATIONS TO YOU OR OPINE ON THE MERITS OF ANY TRANSACTION OR
              OPPORTUNITY. YOU ALONE ARE RESPONSIBLE FOR DETERMINING WHETHER ANY INVESTMENT,
              INVESTMENT STRATEGY OR RELATED TRANSACTION IS APPROPRIATE FOR YOU BASED ON YOUR
              PERSONAL INVESTMENT OBJECTIVES, FINANCIAL CIRCUMSTANCES, AND RISK TOLERANCE.
            </p>

            <h3 className="text-xl font-medium mt-6">
              5.4 BETA SERVICE — EXPERIMENTAL AND UNAUDITED
            </h3>
            <p className="font-semibold">
              YOU ACKNOWLEDGE AND AGREE THAT THE PRODUCTS AND THE PROTOCOL ARE OFFERED AS A PUBLIC
              BETA. AS OF THE DATE OF THIS AGREEMENT, THE PROTOCOL, THE INTERFACE, AND THE
              UNDERLYING SMART CONTRACTS HAVE NOT BEEN AUDITED BY ANY THIRD PARTY, AND NO THIRD-
              PARTY SECURITY AUDIT IS CURRENTLY IN PROGRESS. NOTHING IN THE PRODUCTS, ANY
              COMMUNICATION FROM US, OR ANY DOCUMENTATION SHOULD BE TAKEN AS A REPRESENTATION OR
              WARRANTY THAT THE PRODUCTS OR PROTOCOL HAVE BEEN AUDITED, REVIEWED, OR VERIFIED FOR
              SAFETY, SECURITY, CORRECTNESS, OR FITNESS FOR ANY PURPOSE. IF AN AUDIT IS COMPLETED IN
              THE FUTURE, ITS COMPLETION, SCOPE, OR FINDINGS SHALL NOT BE A REPRESENTATION OR
              WARRANTY BY US AS TO THE SAFETY OR FITNESS OF THE PRODUCTS OR PROTOCOL.
            </p>
            <p>
              YOU ACKNOWLEDGE THAT THE SOFTWARE, SMART CONTRACTS, FRONTEND CODE, AND INFRASTRUCTURE
              UNDERLYING THE PRODUCTS MAY CONTAIN BUGS, ERRORS, VULNERABILITIES, ECONOMIC EXPLOITS,
              ORACLE FAILURES OR MISPRICINGS, SETTLEMENT DELAYS OR FAILURES, LIQUIDATION FAILURES OR
              DELAYS, WITHDRAWAL OR DEPOSIT DELAYS OR FAILURES, DATA LOSS, STATE INCONSISTENCIES, OR
              OTHER DEFECTS THAT COULD RESULT IN THE PARTIAL OR TOTAL LOSS OF YOUR DIGITAL ASSETS.
              YOU FURTHER ACKNOWLEDGE THAT THE ECONOMIC PARAMETERS, COLLATERAL REQUIREMENTS, FEE
              STRUCTURES, AND RISK MODELS OF THE PROTOCOL MAY BE ADJUSTED, MIGRATED, OR REPLACED
              DURING THE BETA PERIOD.
            </p>
            <p>
              WE MAY MODIFY, PAUSE, RESTRICT, RESTART, MIGRATE, ROLL BACK, OR DISCONTINUE THE
              PRODUCTS, THE INTERFACE, OR ANY FEATURE THEREOF AT ANY TIME, WITH OR WITHOUT NOTICE,
              AND WITHOUT LIABILITY TO YOU. WE DO NOT GUARANTEE THE AVAILABILITY OR CONTINUED
              OPERATION OF THE PRODUCTS, AND WE DO NOT GUARANTEE THAT YOU WILL BE ABLE TO ACCESS,
              WITHDRAW, OR RECOVER ANY DIGITAL ASSETS AT ANY PARTICULAR TIME OR AT ALL.
            </p>
            <p className="font-semibold">
              YOU SHOULD NOT DEPOSIT, RISK, OR EXPOSE TO THE PRODUCTS MORE VALUE THAN YOU CAN AFFORD
              TO LOSE ENTIRELY. ALL DISCLAIMERS, RELEASES, INDEMNITIES, AND LIMITATIONS OF LIABILITY
              IN THIS AGREEMENT APPLY WITH FULL FORCE TO ANY LOSSES ARISING FROM OR RELATING TO
              BUGS, EXPLOITS, OR DEFECTS DURING THE BETA PERIOD, AND TO ANY MODIFICATION, PAUSE,
              MIGRATION, OR DISCONTINUATION OF THE PRODUCTS OR PROTOCOL.
            </p>
          </section>

          <section className="space-y-4 mt-8">
            <h2 className="text-2xl font-semibold">6. Indemnification</h2>
            <p>
              You agree to hold harmless, release, defend, and indemnify Isometric and our
              respective officers, directors, employees, contractors, agents, service providers,
              licensors, and representatives (collectively, the &quot;Isometric Parties&quot;) from
              and against all claims, damages, obligations, losses, liabilities, costs, and expenses
              (including reasonable attorney&apos;s fees) arising from or relating to: (a) your
              access and use of any of our Products; (b) your violation of any term or condition of
              this Agreement, the right of any third party, or any other applicable law, rule, or
              regulation; (c) any other party&apos;s access and use of any of our Products with your
              assistance or using any device or account that you own or control; and (d) any dispute
              between you and (i) any other user of any of the Products or (ii) any of your own
              customers or users. We will make commercially reasonable efforts to provide notice to
              you of any such claim, suit, or proceeding, provided that we have sufficient contact
              information to do so; you acknowledge that, because the Products are accessed through
              blockchain wallets and we do not collect direct contact information from you, we may
              be unable to provide such notice, and our inability to do so will not affect your
              indemnification obligations under this Section. We reserve the right to assume the
              exclusive defense and control of any matter which is subject to indemnification under
              this section, and you agree to cooperate with any reasonable requests assisting our
              defense of such matter. You may not settle or compromise any claim against any
              Isometric Party without our written consent.
            </p>
          </section>

          <section className="space-y-4 mt-8">
            <h2 className="text-2xl font-semibold">7. Limitation of Liability</h2>
            <p>
              UNDER NO CIRCUMSTANCES SHALL WE OR ANY ISOMETRIC PARTIES BE LIABLE TO YOU FOR ANY
              INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES,
              INCLUDING, BUT NOT LIMITED TO, DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR
              OTHER INTANGIBLE PROPERTY, ARISING OUT OF OR RELATING TO ANY ACCESS OR USE OF OR
              INABILITY TO ACCESS OR USE ANY OF THE PRODUCTS, NOR WILL WE BE RESPONSIBLE FOR ANY
              DAMAGE, LOSS, OR INJURY RESULTING FROM HACKING, TAMPERING, OR OTHER UNAUTHORIZED
              ACCESS OR USE OF ANY OF THE PRODUCTS OR THE INFORMATION CONTAINED WITHIN IT, WHETHER
              SUCH DAMAGES ARE BASED IN CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE,
              ARISING OUT OF OR IN CONNECTION WITH AUTHORIZED OR UNAUTHORIZED USE OF ANY OF THE
              PRODUCTS, EVEN IF AN AUTHORIZED REPRESENTATIVE OF ISOMETRIC HAS BEEN ADVISED OF OR
              KNEW OR SHOULD HAVE KNOWN OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>
              WE ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY: (A) ERRORS, MISTAKES, OR
              INACCURACIES OF CONTENT; (B) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY NATURE
              WHATSOEVER, RESULTING FROM ANY ACCESS OR USE OF THE INTERFACE; (C) UNAUTHORIZED ACCESS
              OR USE OF ANY SECURE SERVER OR DATABASE IN OUR CONTROL, OR THE USE OF ANY INFORMATION
              OR DATA STORED THEREIN; (D) INTERRUPTION OR CESSATION OF FUNCTION RELATED TO ANY OF
              THE PRODUCTS; (E) BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE THAT MAY BE TRANSMITTED TO
              OR THROUGH THE INTERFACE; (F) ERRORS OR OMISSIONS IN, OR LOSS OR DAMAGE INCURRED AS A
              RESULT OF THE USE OF, ANY CONTENT MADE AVAILABLE THROUGH ANY OF THE PRODUCTS; AND (G)
              THE DEFAMATORY, OFFENSIVE, OR ILLEGAL CONDUCT OF ANY THIRD PARTY.
            </p>
            <p>
              WE HAVE NO LIABILITY TO YOU OR TO ANY THIRD PARTY FOR ANY CLAIMS OR DAMAGES THAT MAY
              ARISE AS A RESULT OF ANY PAYMENTS OR TRANSACTIONS THAT YOU ENGAGE IN VIA ANY OF OUR
              PRODUCTS, OR ANY OTHER PAYMENT OR TRANSACTIONS THAT YOU CONDUCT VIA ANY OF OUR
              PRODUCTS. EXCEPT AS EXPRESSLY PROVIDED FOR HEREIN, WE DO NOT PROVIDE REFUNDS FOR ANY
              PURCHASES THAT YOU MIGHT MAKE ON OR THROUGH ANY OF OUR PRODUCTS.
            </p>
            <p>
              SOME JURISDICTIONS DO NOT ALLOW THE LIMITATION OF LIABILITY FOR PERSONAL INJURY, OR OF
              INCIDENTAL OR CONSEQUENTIAL DAMAGES, SO THIS LIMITATION MAY NOT APPLY TO YOU. IN NO
              EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL DAMAGES (OTHER THAN AS MAY BE REQUIRED
              BY APPLICABLE LAW IN CASES INVOLVING PERSONAL INJURY) EXCEED THE AMOUNT OF ONE HUNDRED
              U.S. DOLLARS ($100.00 USD) OR ITS EQUIVALENT IN THE LOCAL CURRENCY OF THE APPLICABLE
              JURISDICTION.
            </p>
            <p>THE FOREGOING DISCLAIMER WILL NOT APPLY TO THE EXTENT PROHIBITED BY LAW.</p>
          </section>

          <section className="space-y-4 mt-8">
            <h2 className="text-2xl font-semibold">8. Governing Law and Dispute Resolution</h2>

            <h3 className="text-xl font-medium mt-6">8.1 Governing Law</h3>
            <p>
              You agree that the laws of the Republic of South Africa, without regard to principles
              of conflict of laws, govern this Agreement and any dispute arising from or relating to
              this Agreement or your use of the Products.
            </p>

            <h3 className="text-xl font-medium mt-6">8.2 Dispute Resolution</h3>
            <p>
              We will use our best efforts to resolve any potential disputes through informal, good
              faith negotiations. If a potential dispute arises, you must contact us by sending an
              email to support@isometric.fi so that we can attempt to resolve it without resorting
              to formal dispute resolution.
            </p>

            <h3 className="text-xl font-medium mt-6">8.3 Jurisdiction</h3>
            <p>
              You agree that any legal action or proceeding relating to this Agreement or the
              Products shall be brought exclusively in the courts of the Republic of South Africa,
              and you consent to the personal and exclusive jurisdiction of such courts. You and we
              further agree that neither you nor we may bring any claim, dispute, or proceeding
              arising out of or relating to this Agreement or the Products in any court located in
              the United States of America, and each party irrevocably waives any objection that the
              courts of the Republic of South Africa are an inconvenient forum.
            </p>
          </section>

          <section className="space-y-4 mt-8">
            <h2 className="text-2xl font-semibold">9. Miscellaneous</h2>

            <h3 className="text-xl font-medium mt-6">9.1 Entire Agreement</h3>
            <p>
              These terms constitute the entire agreement between you and us with respect to the
              subject matter hereof. This Agreement supersedes any and all prior or contemporaneous
              written and oral agreements, communications and other understandings (if any) relating
              to the subject matter of the terms.
            </p>

            <h3 className="text-xl font-medium mt-6">9.2 Assignment</h3>
            <p>
              You may not assign or transfer this Agreement, by operation of law or otherwise,
              without our prior written consent. Any attempt by you to assign or transfer this
              Agreement without our prior written consent shall be null and void. We may freely
              assign or transfer this Agreement. Subject to the foregoing, this Agreement will bind
              and inure to the benefit of the parties, their successors and permitted assigns.
            </p>

            <h3 className="text-xl font-medium mt-6">
              9.3 Not Registered with Any Regulatory Agency
            </h3>
            <p>
              We are not registered with any securities exchange, financial regulatory authority, or
              similar agency. You understand and acknowledge that we do not broker trading orders on
              your behalf. We also do not facilitate the execution or settlement of your trades,
              which occur entirely on public distributed blockchains. As a result, we do not (and
              cannot) guarantee market best pricing or best execution through our Products.
            </p>

            <h3 className="text-xl font-medium mt-6">9.4 Notice</h3>
            <p>
              We may provide any notice to you under this Agreement using commercially reasonable
              means, including using public communication channels. Notices we provide by using
              public communication channels will be effective upon posting.
            </p>

            <h3 className="text-xl font-medium mt-6">9.5 Severability</h3>
            <p>
              If any provision of this Agreement shall be determined to be invalid or unenforceable
              under any rule, law, or regulation of any local, state, or federal government agency,
              such provision will be changed and interpreted to accomplish the objectives of the
              provision to the greatest extent possible under any applicable law and the validity or
              enforceability of any other provision of this Agreement shall not be affected.
            </p>

            <h3 className="text-xl font-medium mt-6">9.6 Force Majeure</h3>
            <p>
              We will not be liable for any delay, interruption, or failure to perform any
              obligation under this Agreement, or for any losses arising therefrom, due to causes
              beyond our reasonable control, including without limitation acts of God, natural
              disasters, pandemics, epidemics, war, terrorism, civil unrest, government action,
              changes in applicable law or regulation, network or blockchain congestion, chain
              reorganizations or forks, smart-contract failures, third-party service outages,
              internet or telecommunications failures, power failures, denial-of-service or other
              cyberattacks, supply-chain disruptions, or labor disputes.
            </p>

            <h3 className="text-xl font-medium mt-6">9.7 No Class Actions</h3>
            <p>
              To the fullest extent permitted by applicable law, you and Isometric agree that any
              dispute, claim, or controversy arising out of or relating to this Agreement, the
              Products, or the Protocol will be resolved on an individual basis, and you waive any
              right to commence, participate in, or recover under any class, collective,
              consolidated, or representative action against us. If a court or arbitral tribunal of
              competent jurisdiction determines that this waiver is unenforceable as to a particular
              claim, that claim (and only that claim) will be severed from this Section 9.7, and the
              remainder of this Section and this Agreement will continue to apply.
            </p>

            <h3 className="text-xl font-medium mt-6">9.8 Survival</h3>
            <p>
              All provisions of this Agreement that by their nature should survive termination shall
              survive, including without limitation Sections 3 (Intellectual Property), 4.6 (Release
              of Claims), 4.7 (Restricted Persons and Jurisdictions), 4.8 (No Circumvention), 4.9
              (Final and Binding Determinations), 5 (Disclaimers), 6 (Indemnification), 7
              (Limitation of Liability), 8 (Governing Law and Dispute Resolution), and this Section
              9.
            </p>

            <h3 className="text-xl font-medium mt-6">9.9 Limitation Period</h3>
            <p>
              Any claim or cause of action arising out of or relating to this Agreement, the
              Products, or the Protocol must be filed within one (1) year after such claim or cause
              of action arose, or it shall be permanently barred, except where a longer period is
              required by applicable mandatory law that cannot be contractually shortened.
            </p>
          </section>

          <div className="mt-12 pt-8 border-t">
            <Link href="/" className="text-primary hover:underline">
              {isZH ? "← 返回首页" : "← Back to home"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
