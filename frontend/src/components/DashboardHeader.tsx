import React from 'react';
import Logo from '../../public/logo.svg'; // Assuming logo.svg is in the same directory
import { FiChevronDown } from 'react-icons/fi'; // Importando o ícone

const WalletHeader = () => {
  const mockStoreName = "Crypto Emporium";

  return (
    <div className="flex items-center justify-between px-[2vw] py-[5vh]">
      <div className="flex flex-col items-start"> {/* Alterado para coluna e alinhado ao início */}
        <img src={Logo} alt="Logo" className="h-[9vh] mb-2" /> {/* Logo com altura 12vh e largura 12vw */}
        <div className="flex items-center gap-1 cursor-pointer group"> {/* Adicionado div para agrupar texto e ícone */}
          <p className="text-[2.5vh] font-normal text-white group-hover:text-gray-300 transition-colors">{mockStoreName}</p>
          <FiChevronDown className="text-[2.5vh] text-white group-hover:text-gray-300 transition-colors" />
        </div>
      </div>
      {/* You can add more elements here if needed, like a profile icon */}
    </div>
  );
};

export default WalletHeader;
